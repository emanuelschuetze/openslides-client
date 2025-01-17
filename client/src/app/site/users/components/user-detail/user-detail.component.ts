import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { BehaviorSubject } from 'rxjs';

import { ActiveMeetingIdService } from 'app/core/core-services/active-meeting-id.service';
import { ModelSubscription } from 'app/core/core-services/autoupdate.service';
import { SpecificStructuredField } from 'app/core/core-services/model-request-builder.service';
import { OperatorService } from 'app/core/core-services/operator.service';
import { Permission } from 'app/core/core-services/permission';
import { GroupRepositoryService } from 'app/core/repositories/users/group-repository.service';
import { UserRepositoryService } from 'app/core/repositories/users/user-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { MeetingSettingsService } from 'app/core/ui-services/meeting-settings.service';
import { PromptService } from 'app/core/ui-services/prompt.service';
import { genders } from 'app/shared/models/users/user';
import { OneOfValidator } from 'app/shared/validators/one-of-validator';
import { BaseModelContextComponent } from 'app/site/base/components/base-model-context.component';
import { ViewMeeting } from 'app/site/event-management/models/view-meeting';
import { PollService } from 'app/site/polls/services/poll.service';
import { UserPdfExportService } from '../../services/user-pdf-export.service';
import { ViewGroup } from '../../models/view-group';
import { ViewUser } from '../../models/view-user';

/**
 * Users detail component for both new and existing users
 */
@Component({
    selector: 'os-user-detail',
    templateUrl: './user-detail.component.html',
    styleUrls: ['./user-detail.component.scss']
})
export class UserDetailComponent extends BaseModelContextComponent implements OnDestroy {
    /**
     * Info form object
     */
    public personalInfoForm: FormGroup;

    /**
     * if this is the own page
     */
    public ownPage = false;

    /**
     * Editing a user
     */
    public editUser = false;

    /**
     * True if a new user is created
     */
    public newUser = false;

    /**
     * True if the operator has manage permissions
     */
    public canManage = false;

    /**
     * ViewUser model
     */
    public user: ViewUser;

    public get usersGroups(): ViewGroup[] {
        return this.user.groups();
    }

    /**
     * Contains all groups, except for the default group.
     */
    public readonly groups: BehaviorSubject<ViewGroup[]> = new BehaviorSubject<ViewGroup[]>([]);

    public readonly users: BehaviorSubject<ViewUser[]> = new BehaviorSubject<ViewUser[]>([]);

    /**
     * Hold the list of genders (sexes) publicly to dynamically iterate in the view
     */
    public genderList = genders;

    private voteWeightEnabled: boolean;

    public get showVoteWeight(): boolean {
        return this.pollService.isElectronicVotingEnabled && this.voteWeightEnabled;
    }

    private isTemporaryUser = true;

    /**
     * Constructor for user
     *
     * @param title Title
     * @param translate TranslateService
     * @param matSnackBar MatSnackBar
     * @param formBuilder FormBuilder
     * @param route ActivatedRoute
     * @param router Router
     * @param repo UserRepositoryService
     * @param operator OperatorService
     * @param promptService PromptService
     * @param pdfService UserPdfExportService used for export to pdf
     * @param groupRepo
     */
    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        private operatorService: OperatorService,
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private repo: UserRepositoryService,
        private operator: OperatorService,
        private promptService: PromptService,
        private pdfService: UserPdfExportService,
        private groupRepo: GroupRepositoryService,
        private pollService: PollService,
        private meetingSettingsService: MeetingSettingsService,
        private activeMeetingIdService: ActiveMeetingIdService
    ) {
        super(componentServiceCollector);
        this.createForm();
        this.getUserByUrl();

        this.operatorService.operatorUpdatedEvent.subscribe(() => {
            this.updateFormControlsAccessibility();
        });

        this.meetingSettingsService
            .get('users_enable_vote_weight')
            .subscribe(enabled => (this.voteWeightEnabled = enabled));

        this.groupRepo.getViewModelListObservableWithoutDefaultGroup().subscribe(this.groups);
        this.users = this.repo.getViewModelListBehaviorSubject();
    }

    private getUserByUrl(): void {
        if (this.route.snapshot.url[0] && this.route.snapshot.url[0].path === 'new') {
            super.setTitle('New participant');
            this.newUser = true;
            this.setEditMode(true);
        } else {
            this.route.params.subscribe(params => {
                this.loadUserById(Number(params.id));
            });
        }
    }

    private loadUserById(userId: number): void {
        const meetingId = this.activeMeetingIdService.meetingId;
        if (meetingId) {
            this.requestModels({
                viewModelCtor: ViewUser,
                ids: [userId],
                follow: [
                    {
                        idField: SpecificStructuredField(
                            'group_$_ids',
                            this.activeMeetingIdService?.meetingId.toString()
                        )
                    }
                ]
            });
        }

        this.subscriptions.push(
            this.repo.getViewModelObservable(userId).subscribe(user => {
                if (user) {
                    const title = user.getTitle();
                    super.setTitle(title);
                    this.user = user;
                }
            }),
            this.operator.operatorUpdatedEvent.subscribe(() => {
                this.ownPage = this.operator.operatorId === userId;
            })
        );
    }

    /**
     * initialize the form with default values
     */
    public createForm(): void {
        this.personalInfoForm = this.formBuilder.group({
            username: ['', Validators.required],
            title: [''],
            first_name: [''],
            last_name: [''],
            gender: [''],
            structure_level: [''],
            number: [''],
            vote_weight: [],
            about_me: [''],
            group_ids: [[]],
            vote_delegations_from_ids: [[]],
            vote_delegated_to_id: [''],
            is_present: [true],
            is_physical_person: [true],
            email: ['', Validators.email],
            last_email_send: [''],
            comment: [''],
            is_active: [true],
            default_password: ['']
        });
    }

    /**
     * Should determine if the user (Operator) has the
     * correct permission to perform the given action.
     *
     * actions might be:
     * - delete         (deleting the user) (users.can_manage and not ownPage)
     * - seeName        (title, first, last, gender, about) (user.can_see_name or ownPage)
     * - seeOtherUsers  (title, first, last, gender, about) (user.can_see_name)
     * - seeExtra       (email, comment, is_active, last_email_send) (user.can_see_extra_data)
     * - seePersonal    (mail, username, structure level) (user.can_see_extra_data or ownPage)
     * - manage         (everything) (user.can_manage)
     * - changePersonal (mail, username, about) (user.can_manage or ownPage)
     * - changePassword (user.can_change_password)
     *
     * @param action the action the user tries to perform
     */
    public isAllowed(action: string): boolean {
        switch (action) {
            case 'delete':
                return this.operator.hasPerms(Permission.usersCanManage) && !this.ownPage;
            case 'manage':
                return this.operator.hasPerms(Permission.usersCanManage);
            case 'seeName':
                return this.operator.hasPerms(Permission.usersCanSee, Permission.usersCanManage) || this.ownPage;
            case 'seeOtherUsers':
                return this.operator.hasPerms(Permission.usersCanSee, Permission.usersCanManage);
            case 'seeExtra':
                return this.operator.hasPerms(Permission.usersCanSeeExtraData, Permission.usersCanManage);
            case 'seePersonal':
                return (
                    this.operator.hasPerms(Permission.usersCanSeeExtraData, Permission.usersCanManage) || this.ownPage
                );
            case 'changePersonal':
                return this.operator.hasPerms(Permission.usersCanManage) || this.ownPage;
            case 'changePassword':
                return (
                    (this.ownPage && this.operator.hasPerms(Permission.usersCanChangeOwnPassword)) ||
                    this.operator.hasPerms(Permission.usersCanManage)
                );
            default:
                return false;
        }
    }

    /**
     * Loads values that require external references
     * And allows async reading
     */
    public patchFormValues(): void {
        const personalInfoPatch = {};
        Object.keys(this.personalInfoForm.controls).forEach(ctrl => {
            if (typeof this.user[ctrl] === 'function') {
                personalInfoPatch[ctrl] = this.user[ctrl]();
            } else {
                personalInfoPatch[ctrl] = this.user[ctrl];
            }
        });
        this.personalInfoForm.patchValue(personalInfoPatch);
    }

    /**
     * Makes the form editable
     */
    public updateFormControlsAccessibility(): void {
        const formControlNames = Object.keys(this.personalInfoForm.controls);

        // Enable all controls.
        formControlNames.forEach(formControlName => {
            this.personalInfoForm.get(formControlName).enable();
        });

        // Disable not permitted controls
        if (!this.isAllowed('manage')) {
            formControlNames.forEach(formControlName => {
                if (!['username', 'email', 'about_me'].includes(formControlName)) {
                    this.personalInfoForm.get(formControlName).disable();
                }
            });
        }
    }

    /**
     * Handler for the generate Password button.
     */
    public generatePassword(): void {
        this.personalInfoForm.patchValue({
            default_password: this.repo.getRandomPassword()
        });
    }

    /**
     * clicking Shift and Enter will save automatically
     *
     * @param event has the code
     */
    public onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Enter' && event.shiftKey) {
            this.saveUser();
        }
    }

    /**
     * Save / Submit a user
     */
    public async saveUser(): Promise<void> {
        if (this.personalInfoForm.invalid) {
            this.checkFormForErrors();
            return;
        }

        try {
            this.createOrUpdateUser();
        } catch (e) {
            this.raiseError(e);
        }
    }

    private async createOrUpdateUser(): Promise<void> {
        if (this.isTemporaryUser) {
            if (this.newUser) {
                await this.createTemporaryUser();
            } else {
                await this.updateTemporaryUser();
            }
        } else {
            if (this.newUser) {
                await this.createRealUser();
            } else {
                await this.updateRealUser();
            }
        }
    }

    /**
     * sets editUser variable and editable form
     * @param edit
     */
    public async setEditMode(edit: boolean): Promise<void> {
        if (this.user && edit && !this.user.meeting_id) {
            this.isTemporaryUser = false;
        }

        if (!this.hasSubscription('edit subscription')) {
            await this.requestModels(
                {
                    viewModelCtor: ViewMeeting,
                    ids: [this.activeMeetingIdService.meetingId],
                    follow: ['group_ids', { idField: 'user_ids', fieldset: 'shortName' }]
                },
                'edit subscription'
            );
        }

        this.editUser = edit;
        this.updateFormControlsAccessibility();

        if (!this.newUser && edit) {
            this.patchFormValues();
        }

        // case: abort creation of a new user
        if (this.newUser && !edit) {
            this.goToAllUsers();
        }
    }

    /**
     * click on the delete user button
     */
    public async deleteUserButton(): Promise<void> {
        const title = this.translate.instant('Are you sure you want to delete this participant?');
        const content = this.user.full_name;
        if (await this.promptService.open(title, content)) {
            await this.repo.delete(this.user);
            this.goToAllUsers();
        }
    }

    /**
     * navigate to the change Password site
     */
    public changePassword(): void {
        this.router.navigate([this.activeMeetingId, 'users', 'password', this.user.id]);
    }

    /**
     * Triggers the pdf download for this user
     */
    public onDownloadPdf(): void {
        this.pdfService.exportSingleUserAccessPDF(this.user);
    }

    /**
     * (Re)- send an invitation email for this user after confirmation
     */
    public async sendInvitationEmail(): Promise<void> {
        const title = this.translate.instant('Sending an invitation email');
        const content = this.translate.instant('Are you sure you want to send an invitation email to the user?');
        if (await this.promptService.open(title, content)) {
            this.repo.bulkSendInvitationEmail([this.user]).then(this.raiseError, this.raiseError);
        }
    }

    /**
     * Fetches a localized string for the time the last email was sent.
     *
     * @returns a translated string with either the localized date/time; of 'No email sent'
     */
    public getEmailSentTime(): string {
        if (!this.user.isLastEmailSend) {
            return this.translate.instant('No email sent');
        }
        return this.repo.lastSentEmailTimeString(this.user);
    }

    private async createRealUser(): Promise<void> {
        const payload = {
            ...this.personalInfoForm.value,
            ...this.createVoteDelegationObject(this.personalInfoForm.value)
        };
        await this.repo.create(payload);
        this.goToAllUsers();
    }

    private async updateRealUser(): Promise<void> {
        const payload = {
            ...this.personalInfoForm.value,
            ...this.createVoteDelegationObject(this.personalInfoForm.value)
        };
        await this.repo.update(payload, this.user);
        this.setEditMode(false);
    }

    private async createTemporaryUser(): Promise<void> {
        await this.repo.createTemporary(this.personalInfoForm.value);
        this.goToAllUsers();
    }

    private async updateTemporaryUser(): Promise<void> {
        await this.repo.update(this.personalInfoForm.value, this.user);
        this.setEditMode(false);
    }

    private checkFormForErrors(): void {
        let hint = '';
        if (this.personalInfoForm.errors) {
            hint = 'At least one of username, first name or last name has to be set.';
        } else {
            for (const formControl in this.personalInfoForm.controls) {
                if (this.personalInfoForm.get(formControl).errors) {
                    hint = formControl + ' is incorrect.';
                }
            }
        }
        this.raiseError(this.translate.instant(hint));
    }

    private createVoteDelegationObject(payload: any): any {
        return {
            vote_delegations_from_ids: {
                [this.activeMeetingIdService.meetingId]: payload.vote_delegations_from_ids
            }
        };
    }

    private goToAllUsers(): void {
        this.router.navigate([this.activeMeetingId, 'users']);
    }
}
