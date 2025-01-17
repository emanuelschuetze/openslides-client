import { Injectable } from '@angular/core';

import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import { ActiveMeetingIdService } from './active-meeting-id.service';
import { ViewMeeting } from 'app/site/event-management/models/view-meeting';
import { AutoupdateService, ModelSubscription } from './autoupdate.service';
import { MeetingRepositoryService } from '../repositories/event-management/meeting-repository.service';
import { SimplifiedModelRequest } from './model-request-builder.service';

export class NoActiveMeeting extends Error {}

@Injectable({
    providedIn: 'root'
})
export class ActiveMeetingService {
    private meetingSubject = new BehaviorSubject<ViewMeeting | null>(null);
    private meetingSubcription: Subscription = null;

    protected modelAutoupdateSubscription: ModelSubscription | null = null;

    public get guestsEnabled(): boolean {
        const activeMeeting = this.meetingSubject.getValue();
        return activeMeeting ? activeMeeting.enable_anonymous : false;
    }

    public get meetingIdObservable(): Observable<number | null> {
        return this.activeMeetingIdService.meetingIdObservable;
    }

    public get meetingId(): number | null {
        return this.activeMeetingIdService.meetingId;
    }

    public get meetingObservable(): Observable<ViewMeeting | null> {
        return this.meetingSubject.asObservable();
    }

    public get meeting(): ViewMeeting | null {
        return this.meetingSubject.getValue();
    }

    public constructor(
        private activeMeetingIdService: ActiveMeetingIdService,
        private repo: MeetingRepositoryService,
        private autoupdateService: AutoupdateService
    ) {
        this.activeMeetingIdService.meetingIdObservable.subscribe(id => {
            if (id !== undefined) {
                this.setupModelSubscription(id);
            }
        });
    }

    private async setupModelSubscription(id: number | null): Promise<void> {
        if (this.modelAutoupdateSubscription) {
            this.modelAutoupdateSubscription.close();
            this.modelAutoupdateSubscription = null;
        }

        if (id) {
            this.modelAutoupdateSubscription = await this.autoupdateService.simpleRequest(
                this.getModelRequest(),
                'ActiveMeetingService'
            );

            if (this.meetingSubcription) {
                this.meetingSubcription.unsubscribe();
            }
            this.meetingSubcription = this.repo.getViewModelObservable(id).subscribe(meeting => {
                this.meetingSubject.next(meeting);
            });
        } else {
            this.meetingSubject.next(null);
        }
    }

    private getModelRequest(): SimplifiedModelRequest {
        return {
            viewModelCtor: ViewMeeting,
            ids: [this.meetingId],
            follow: [
                { idField: 'default_group_id' }, // needed by the operator!
                { idField: 'admin_group_id' },
                {
                    idField: 'projector_ids',
                    follow: [
                        { idField: 'current_projection_ids', follow: [{ idField: 'content_object_id' }] },
                        { idField: 'preview_projection_ids', follow: [{ idField: 'content_object_id' }] }
                        // {idField: 'used_as_default_$_in_meeting_id'} // TODO
                    ]
                },
                {
                    // needed for the voting-banner
                    idField: 'poll_ids',
                    fieldset: 'list',
                    follow: [{ idField: 'content_object_id' }]
                }
            ],
            fieldset: 'settings',
            additionalFields: [
                { templateField: 'logo_$_id' }, // needed by the media manage service
                { templateField: 'font_$_id' },
                'reference_projector_id'
            ]
        };
    }
}
