import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { BehaviorSubject } from 'rxjs';

import { Id } from 'app/core/definitions/key-types';
import { PollRepositoryService } from 'app/core/repositories/polls/poll-repository.service';
import { BasePollDialogService } from 'app/core/ui-services/base-poll-dialog.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { PromptService } from 'app/core/ui-services/prompt.service';
import { ChartData } from 'app/shared/components/charts/charts.component';
import { PollState, PollType } from 'app/shared/models/poll/poll-constants';
import { ViewPoll } from 'app/shared/models/poll/view-poll';
import { BaseViewModel } from 'app/site/base/base-view-model';
import { BaseModelContextComponent } from 'app/site/base/components/base-model-context.component';

@Component({
    template: ''
})
export abstract class BasePollComponent<C extends BaseViewModel = any> extends BaseModelContextComponent {
    public stateChangePending = false;
    public chartDataSubject: BehaviorSubject<ChartData> = new BehaviorSubject([]);

    protected _id: Id;

    public get poll(): ViewPoll<C> {
        return this._poll;
    }

    protected _poll: ViewPoll<C>;

    public pollStateActions = {
        [PollState.Created]: {
            icon: 'play_arrow',
            css: 'start-poll-button'
        },
        [PollState.Started]: {
            icon: 'stop',
            css: 'stop-poll-button'
        },
        [PollState.Finished]: {
            icon: 'public',
            css: 'publish-poll-button'
        }
    };

    public get hideChangeState(): boolean {
        return this._poll.isPublished || (this._poll.isCreated && this._poll.type === PollType.Analog);
    }

    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        protected dialog: MatDialog,
        protected promptService: PromptService,
        protected repo: PollRepositoryService,
        protected pollDialog: BasePollDialogService
    ) {
        super(componentServiceCollector);
    }

    public async changeState(key: PollState): Promise<void> {
        if (key === PollState.Created) {
            const title = this.translate.instant('Are you sure you want to reset this vote?');
            const content = this.translate.instant('All votes will be lost.');
            if (await this.promptService.open(title, content)) {
                this.stateChangePending = true;
                await this.repo.resetPoll(this._poll);
                this.stateChangePending = false;
            }
        } else {
            this.stateChangePending = true;
            await this.doActionDependingOnState(key);
            this.stateChangePending = false;
        }
    }

    public resetState(): void {
        this.changeState(PollState.Created);
    }

    /**
     * Handler for the 'delete poll' button
     */
    public async deletePoll(): Promise<void> {
        const title = this.translate.instant('Are you sure you want to delete this vote?');
        const content = this._poll.getTitle();
        if (await this.promptService.open(title, content)) {
            await this.repo.delete(this._poll);
        }
    }

    /**
     * Edits the poll
     */
    public openDialog(): void {
        this.pollDialog.openDialog(this._poll);
    }

    protected doActionDependingOnState(nextState: PollState): Promise<void> {
        switch (nextState) {
            case PollState.Started:
                return this.repo.startPoll(this._poll);
            case PollState.Finished:
                return this.repo.stopPoll(this._poll);
            case PollState.Published:
                return this.repo.publishPoll(this._poll);
        }
    }

    protected initializePoll(id: Id): void {
        this._id = id;
        this.loadPoll(this._id);
    }

    /**
     * Hook to listen to changes. A poll is already available.
     */
    protected onAfterUpdatePoll(_poll: ViewPoll<C>): void {}

    protected loadPoll(id: Id): void {
        this.requestModels({
            viewModelCtor: ViewPoll,
            ids: [id],
            follow: [
                {
                    idField: 'option_ids',
                    follow: [{ idField: 'vote_ids' }, { idField: 'content_object_id' }]
                },
                {
                    idField: 'global_option_id',
                    follow: [{ idField: 'vote_ids' }]
                }
            ]
        });

        this.subscriptions.push(
            this.repo.getViewModelObservable(this._id).subscribe(poll => {
                console.log('getViewModelObservable::', poll);
                if (poll) {
                    this._poll = poll;
                    this.onAfterUpdatePoll(poll);
                }
            })
        );
    }
}
