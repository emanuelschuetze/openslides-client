import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { PblColumnDefinition } from '@pebula/ngrid';
import { BehaviorSubject, Observable } from 'rxjs';

import { SimplifiedModelRequest } from 'app/core/core-services/model-request-builder.service';
import { CommitteeRepositoryService } from 'app/core/repositories/event-management/committee-repository.service';
import { MeetingRepositoryService } from 'app/core/repositories/event-management/meeting-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { PromptService } from 'app/core/ui-services/prompt.service';
import { BaseListViewComponent } from 'app/site/base/components/base-list-view.component';
import { ViewCommittee } from 'app/site/event-management/models/view-committee';
import { ViewMeeting } from 'app/site/event-management/models/view-meeting';
import { ViewOrganisation } from 'app/site/event-management/models/view-organisation';

/**
 * Meeting list "as known as" Committee detail
 */
@Component({
    selector: 'os-meetings',
    templateUrl: './meeting-list.component.html',
    styleUrls: ['./meeting-list.component.scss']
})
export class MeetingListComponent extends BaseListViewComponent<ViewOrganisation> implements OnInit {
    private committeeId: number;

    public currentCommitteeObservable: Observable<ViewCommittee>;

    public currentCommittee: ViewCommittee;

    public tableColumnDefinition: PblColumnDefinition[] = [
        {
            prop: 'name',
            width: 'auto'
        },
        {
            prop: 'users',
            width: '70px'
        }
    ];

    public get meetingsObservable(): Observable<ViewMeeting[]> {
        return this.meetingsSubject.asObservable();
    }

    private readonly meetingsSubject = new BehaviorSubject<ViewMeeting[]>([]);

    public constructor(
        public meetingRepo: MeetingRepositoryService,
        private committeeRepo: CommitteeRepositoryService,
        protected componentServiceCollector: ComponentServiceCollector,
        private router: Router,
        private route: ActivatedRoute,
        private promptService: PromptService
    ) {
        super(componentServiceCollector);
        super.setTitle('Meetings');
        this.getCommitteeByUrl();
    }

    public ngOnInit(): void {
        super.ngOnInit();
    }

    public onCreateMeeting(): void {
        this.router.navigate(['create'], { relativeTo: this.route });
    }

    public onEditCommittee(): void {
        this.router.navigate(['edit-committee'], { relativeTo: this.route.parent });
    }

    public editSingle(meeting: ViewMeeting): void {
        this.router.navigate(['edit-meeting', meeting.id], { relativeTo: this.route });
    }

    public async deleteSingle(meeting: ViewMeeting): Promise<void> {
        const title = `${this.translate.instant('Delete meeting')} "${meeting.name}"`;
        const content = this.translate.instant('Are you sure you want to delete this meeting?');

        const confirmed = await this.promptService.open(title, content);
        if (confirmed) {
            await this.meetingRepo.delete(meeting);
        }
    }

    private getCommitteeByUrl(): void {
        this.subscriptions.push(
            this.route.params.subscribe(async params => {
                if (params) {
                    this.committeeId = Number(params.committeeId);
                    await this.loadCommittee(this.committeeId);
                }
            })
        );
    }

    private async loadCommittee(id: number): Promise<void> {
        this.currentCommitteeObservable = this.committeeRepo.getViewModelObservable(id);
        this.subscriptions.push(
            this.currentCommitteeObservable.subscribe(committee => {
                this.currentCommittee = committee;
                this.meetingsSubject.next(committee.meetings || []);
            })
        );
    }

    protected getModelRequest(): SimplifiedModelRequest {
        return {
            viewModelCtor: ViewCommittee,
            ids: [this.committeeId],
            follow: [
                {
                    idField: 'meeting_ids',
                    fieldset: 'list'
                }
            ],
            fieldset: 'list'
        };
    }
}
