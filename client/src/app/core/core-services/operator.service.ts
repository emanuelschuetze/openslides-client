import { EventEmitter, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { NoActiveMeeting } from './active-meeting-id.service';
import { ActiveMeetingService } from './active-meeting.service';
import { Group } from 'app/shared/models/users/group';
import { ViewMeeting } from 'app/site/event-management/models/view-meeting';
import { ViewUser } from 'app/site/users/models/view-user';
import { AuthService } from './auth.service';
import { AutoupdateService, ModelSubscription } from './autoupdate.service';
import { DataStoreService } from './data-store.service';
import { GroupRepositoryService } from '../repositories/users/group-repository.service';
import { Id } from '../definitions/key-types';
import { LifecycleService } from './lifecycle.service';
import { SimplifiedModelRequest, SpecificStructuredField } from './model-request-builder.service';
import { Permission } from './permission';
import { UserRepositoryService } from '../repositories/users/user-repository.service';

const UNKOWN_USER_ID = -1; // this is an invalid id **and** not equal to 0, null, undefined.

/**
 * The operator represents the user who is using OpenSlides.
 *
 * Changes in operator can be observed, directives do so on order to show
 * or hide certain information.
 */
@Injectable({
    providedIn: 'root'
})
export class OperatorService {
    public get operatorId(): number | null {
        return this.isAnonymous ? null : this.authService.authToken.userId;
    }

    public get isAnonymous(): boolean {
        return !this.authService.authToken;
    }

    public get isAuthenticated(): boolean {
        return !this.isAnonymous;
    }

    public get shortName(): string {
        return this._shortName;
    }
    private _shortName: string;

    // permissions and groupIds are bound to the active meeting.
    // If there is no active meeting, both will be null.
    // If groupIds is null or [], the default group must be used.

    private permissions: Permission[] | null = null;
    private groupIds: Id[] | null = null;

    public get isSuperAdmin(): boolean {
        if (this.defaultGroupId) {
            return this.isInGroupIdsNonAdminCheck(this.defaultGroupId);
        } else {
            throw new NoActiveMeeting();
        }
    }

    /**
     * Subject for the operator as a view user.
     */
    private operatorIdSubject: BehaviorSubject<number | null> = new BehaviorSubject<number | null>(null);

    public get operatorIdObservable(): Observable<number | null> {
        return this.operatorIdSubject.asObservable();
    }

    /**
     * This eventemitter gets fired on every change:
     * Either the operator itself changed or the model or permission changed.
     */
    public readonly operatorUpdatedEvent: EventEmitter<void> = new EventEmitter();

    private operatorShortNameSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
    private userSubject = new BehaviorSubject<ViewUser | null>(null);

    public get operatorShortNameObservable(): Observable<string | null> {
        return this.operatorShortNameSubject.asObservable();
    }

    public get userObservable(): Observable<ViewUser | null> {
        return this.userSubject.asObservable();
    }

    private _loaded: Promise<void>;
    public get loaded(): Promise<void> {
        return this._loaded;
    }

    private currentOperatorDataSubscription: ModelSubscription | null = null;

    private get activeMeetingId(): number | null {
        return this.activeMeetingService.meetingId;
    }
    private get activeMeeting(): ViewMeeting | null {
        return this.activeMeetingService.meeting;
    }
    private get anonymousEnabled(): boolean {
        return this.activeMeetingService.guestsEnabled;
    }
    private get defaultGroupId(): number | null {
        const activeMeeting = this.activeMeetingService.meeting;
        return activeMeeting ? activeMeeting.default_group_id : null;
    }
    private get adminGroupId(): number | null {
        const activeMeeting = this.activeMeetingService.meeting;
        return activeMeeting ? activeMeeting.admin_group_id : null;
    }

    private hasOperatorDataSubscriptionInitiated = false;

    private _lastActiveMeetingId;
    private _lastDefaultGroupId;
    private _lastUserId = UNKOWN_USER_ID;

    public constructor(
        private authService: AuthService,
        private DS: DataStoreService,
        private autoupdateService: AutoupdateService,
        private activeMeetingService: ActiveMeetingService,
        private userRepo: UserRepositoryService,
        private groupRepo: GroupRepositoryService,
        private router: Router,
        private lifecycle: LifecycleService
    ) {
        this._loaded = this.operatorUpdatedEvent.pipe(take(1)).toPromise();

        this.authService.onLogout.subscribe(() => this.navigateOnLogout());
        this.authService.authTokenObservable.subscribe(token => {
            const id = token ? token.userId : null;
            if (id !== this._lastUserId) {
                console.debug('operator: user changed from ', this._lastUserId, 'to', id);
                this._lastUserId = id;
                this.refreshOperatorDataSubscription();
            }
        });
        this.activeMeetingService.meetingObservable.subscribe(meeting => {
            if (
                (!meeting && this._lastActiveMeetingId) ||
                (meeting &&
                    (meeting.id !== this._lastActiveMeetingId || meeting.default_group_id !== this._lastDefaultGroupId))
            ) {
                console.debug('operator: active meeting changed from ', this._lastActiveMeetingId, 'to', meeting?.id);
                this._lastActiveMeetingId = meeting ? meeting.id : null;
                this._lastDefaultGroupId = meeting ? meeting.default_group_id : null;

                this.refreshOperatorDataSubscription();
            }
        });

        this.userRepo.getGeneralViewModelObservable().subscribe(user => {
            if (user !== undefined && this.operatorId === user.id) {
                this._shortName = this.userRepo.getShortName(user);

                if (this.activeMeetingId) {
                    this.groupIds = user.group_ids(this.activeMeetingId);
                    this.permissions = this.calcPermissions();
                }

                // TODO: get users role

                this.operatorShortNameSubject.next(this._shortName);
                this.userSubject.next(user);
                this.operatorUpdatedEvent.emit();
            }
        });
        this.groupRepo.getGeneralViewModelObservable().subscribe(group => {
            if (!this.activeMeetingId) {
                return;
            }

            if (this.isAnonymous && group.id === this.defaultGroupId) {
                this.permissions = this.calcPermissions();
                this.operatorUpdatedEvent.emit();
            } else if (!this.isAnonymous) {
                if (
                    ((!this.groupIds || this.groupIds.length === 0) && group.id === this.defaultGroupId) ||
                    (this.groupIds && this.groupIds.length > 0 && this.groupIds.includes(group.id))
                ) {
                    this.permissions = this.calcPermissions();
                    this.operatorUpdatedEvent.emit();
                }
            }
        });
    }

    private async refreshOperatorDataSubscription(): Promise<void> {
        if (this.currentOperatorDataSubscription) {
            this.currentOperatorDataSubscription.close();
            this.currentOperatorDataSubscription = null;
            this.hasOperatorDataSubscriptionInitiated = false;
        }

        await this.lifecycle.booted;
        console.log('Operator: lifecycle booted. Resume operatorsubscription.');

        let operatorRequest: SimplifiedModelRequest = null;
        if (this.activeMeetingId) {
            if (this.isAuthenticated) {
                operatorRequest = {
                    ids: [this.operatorId],
                    viewModelCtor: ViewUser,
                    fieldset: 'shortName',
                    follow: [
                        {
                            idField: SpecificStructuredField('group_$_ids', this.activeMeetingId),
                            fieldset: ['permissions']
                        }
                    ]
                };
            } else if (this.anonymousEnabled) {
                operatorRequest = {
                    ids: [this.activeMeetingId],
                    viewModelCtor: ViewMeeting,
                    follow: [
                        {
                            idField: 'default_group_id',
                            fieldset: ['permissions']
                        }
                    ],
                    fieldset: []
                };
            }
            // No else-case: A non-authed no meeting is not possible (or: there are no usefull information).
        } else {
            if (this.isAuthenticated) {
                operatorRequest = {
                    ids: [this.operatorId],
                    viewModelCtor: ViewUser,
                    fieldset: 'shortName'
                };
            } else {
                // not logged in and no anonymous. We are done with loading, so we have
                // to emit the operator update event
                this.operatorUpdatedEvent.emit();
            }
        }

        if (operatorRequest && !this.hasOperatorDataSubscriptionInitiated) {
            this.hasOperatorDataSubscriptionInitiated = true;
            // Do not wait for the subscription to be done...
            (async () => {
                console.log('operator: Do operator model request', operatorRequest);
                this.currentOperatorDataSubscription = await this.autoupdateService.simpleRequest(
                    operatorRequest,
                    'OperatorService'
                );
            })();
        }
    }

    /**
     * Update the operators permissions and publish the operator afterwards.
     * Saves the current WhoAmI to storage with the updated permissions
     */
    private calcPermissions(): Permission[] {
        let permissions;
        if (this.groupIds === null) {
            permissions = [];
        } else if (this.isAnonymous || this.groupIds.length === 0) {
            // Anonymous or users in the default group.
            permissions = this.activeMeeting?.default_group?.permissions || [];
        } else {
            const permissionSet = new Set<string>();
            this.DS.getMany(Group, this.groupIds).forEach(group => {
                group.permissions?.forEach(permission => {
                    permissionSet.add(permission);
                });
            });
            permissions = Array.from(permissionSet.values());
        }

        return permissions;
    }

    /**
     * Checks, if the operator has at least one of the given permissions.
     * @param checkPerms The permissions to check, if at least one matches.
     *
     * TODO: what if no active meeting??
     */
    public hasPerms(...checkPerms: Permission[]): boolean {
        if (this.groupIds === null) {
            return false;
        }
        if (this.isAuthenticated && this.groupIds.includes(this.adminGroupId)) {
            return true;
        }
        return checkPerms.some(permission => {
            return this.permissions.includes(permission);
        });
    }

    /**
     * Returns true, if the operator is in at least one group or he is in the admin group.
     * @param groups The groups to check
     *
     * TODO: what if no active meeting??
     */
    public isInGroup(...groups: Group[]): boolean {
        return this.isInGroupIds(...groups.map(group => group.id));
    }

    /**
     * Returns true, if the operator is in at least one group or he is in the admin group.
     * @param groups The group ids to check
     *
     * TODO: what if no active meeting??
     */
    public isInGroupIds(...groupIds: number[]): boolean {
        if (this.groupIds === null) {
            return false;
        }
        if (!this.isInGroupIdsNonAdminCheck(...groupIds)) {
            // An admin has all perms and is technically in every group.
            return this.groupIds.includes(this.adminGroupId);
        }
        return true;
    }

    /**
     * Returns true, if the operator is in at least one group.
     * @param groups The group ids to check
     */
    public isInGroupIdsNonAdminCheck(...groupIds: number[]): boolean {
        if (this.groupIds === null) {
            return false;
        }
        if (this.isAnonymous) {
            return groupIds.includes(this.defaultGroupId); // any anonymous is in the default group.
        }
        return groupIds.some(id => this.groupIds.includes(id));
    }

    /**
     * Checks if guests are enabled. If they are not enabled, then a user has to be navigated
     * to the login-page.
     * This behaviour prevents a non-redirect on the startpage.
     */
    private navigateOnLogout(): void {
        if (this.anonymousEnabled) {
            this.router.navigate(['/']);
        } else {
            this.router.navigate(['/login']);
        }
    }
}
