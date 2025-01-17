import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { PblColumnDefinition } from '@pebula/ngrid';

import { ActiveMeetingIdService } from 'app/core/core-services/active-meeting-id.service';
import { SimplifiedModelRequest } from 'app/core/core-services/model-request-builder.service';
import { OperatorService } from 'app/core/core-services/operator.service';
import { Permission } from 'app/core/core-services/permission';
import { AssignmentRepositoryService } from 'app/core/repositories/assignments/assignment-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { PromptService } from 'app/core/ui-services/prompt.service';
import { ViewportService } from 'app/core/ui-services/viewport.service';
import { SPEAKER_BUTTON_FOLLOW } from 'app/shared/components/speaker-button/speaker-button.component';
import { BaseListViewComponent } from 'app/site/base/components/base-list-view.component';
import { ViewMeeting } from 'app/site/event-management/models/view-meeting';
import { AssignmentFilterListService } from '../../services/assignment-filter-list.service';
import { AssignmentPdfExportService } from '../../services/assignment-pdf-export.service';
import { AssignmentSortListService } from '../../services/assignment-sort-list.service';
import { AssignmentPhases, ViewAssignment } from '../../models/view-assignment';

/**
 * List view for the assignments
 */
@Component({
    selector: 'os-assignment-list',
    templateUrl: './assignment-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrls: ['./assignment-list.component.scss']
})
export class AssignmentListComponent extends BaseListViewComponent<ViewAssignment> implements OnInit {
    /**
     * The different phases of an assignment. Info is fetched from server
     */
    public phaseOptions = AssignmentPhases;

    /**
     * Define the columns to show
     */
    public tableColumnDefinition: PblColumnDefinition[] = [
        {
            prop: 'title',
            width: 'auto'
        },
        {
            prop: 'phase',
            width: '20%',
            minWidth: 180
        },
        {
            prop: 'candidates',
            width: this.singleButtonWidth
        }
    ];

    /**
     * Define extra filter properties
     */
    public filterProps = ['title', 'candidates', 'assignment_related_users', 'tags', 'candidateAmount'];

    public get canManageAssignments(): boolean {
        return this.operator.hasPerms(Permission.assignmentsCanManage);
    }

    /**
     * Constructor.
     *
     * @param titleService
     * @param storage
     * @param translate
     * @param matSnackBar
     * @param repo the repository
     * @param promptService
     * @param filterService: A service to supply the filtered datasource
     * @param sortService: Service to sort the filtered dataSource
     * @param route
     * @param router
     * @param operator
     */
    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        public repo: AssignmentRepositoryService,
        private promptService: PromptService,
        public filterService: AssignmentFilterListService,
        public sortService: AssignmentSortListService,
        private pdfService: AssignmentPdfExportService,
        protected route: ActivatedRoute,
        private router: Router,
        private operator: OperatorService,
        public vp: ViewportService,
        private activeMeetingIdService: ActiveMeetingIdService
    ) {
        super(componentServiceCollector);
        this.canMultiSelect = true;
    }

    /**
     * Init function.
     * Sets the title, inits the table
     */
    public ngOnInit(): void {
        super.ngOnInit();
        super.setTitle('Elections');
    }

    protected getModelRequest(): SimplifiedModelRequest {
        return {
            viewModelCtor: ViewMeeting,
            ids: [this.activeMeetingIdService.meetingId],
            follow: [
                {
                    idField: 'assignment_ids',
                    follow: [SPEAKER_BUTTON_FOLLOW],
                    fieldset: 'list'
                }
            ],
            fieldset: []
        };
    }

    /**
     * Handles a click on the plus button delegated from head-bar.
     * Creates a new assignment
     */
    public onPlusButton(): void {
        this.router.navigate(['./new'], { relativeTo: this.route });
    }

    /**
     * @returns all the number of the columns that should be hidden in mobile
     */
    public getColumnsHiddenInMobile(): string[] {
        const hiddenInMobile = ['phase', 'candidates'];

        if (!this.operator.hasPerms(Permission.listOfSpeakersCanSee, Permission.projectorCanManage)) {
            hiddenInMobile.push('menu');
        }

        return hiddenInMobile;
    }

    /**
     * Function to download the assignment list
     *
     * @param assignments Optional parameter: If given, the chosen list will be exported,
     * otherwise the whole list of assignments is exported.
     */
    public downloadAssignmentButton(assignments?: ViewAssignment[]): void {
        this.pdfService.exportMultipleAssignments(assignments ? assignments : this.repo.getViewModelList());
    }

    public getCandidateAmount(assignments: ViewAssignment): number {
        return assignments.candidateAmount;
    }

    /**
     * Handler for deleting multiple entries. Needs items in selectedRows, which
     * is only filled with any data in multiSelect mode
     */
    public async deleteSelected(): Promise<void> {
        const title = this.translate.instant('Are you sure you want to delete all selected elections?');
        // if (await this.promptService.open(title)) {
        //     for (const assignment of this.selectedRows) {
        //         await this.repo.delete(assignment);
        //     }
        // }
        throw new Error('TODO!');
    }
}
