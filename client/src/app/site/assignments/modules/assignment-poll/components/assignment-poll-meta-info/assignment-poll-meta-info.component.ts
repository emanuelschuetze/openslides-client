import { Component, Input } from '@angular/core';

import { PollPropertyVerbose } from 'app/shared/models/poll/poll-constants';
import { ViewOption } from 'app/shared/models/poll/view-option';
import { ViewPoll } from 'app/shared/models/poll/view-poll';
import { UnknownUserLabel } from 'app/site/assignments/modules/assignment-poll/services/assignment-poll.service';

@Component({
    selector: 'os-assignment-poll-meta-info',
    templateUrl: './assignment-poll-meta-info.component.html',
    styleUrls: ['./assignment-poll-meta-info.component.scss']
})
export class AssignmentPollMetaInfoComponent {
    public pollPropertyVerbose = PollPropertyVerbose;
    private unknownUserLabel = UnknownUserLabel;

    @Input()
    public poll: ViewPoll;

    @Input()
    public showCandidates = true;

    public get hasGlobalOptionEnabled(): boolean {
        return this.poll.hasGlobalOptionEnabled;
    }

    public constructor() {}

    public userCanVote(): boolean {
        return this.poll.canBeVotedFor();
    }

    public getOptionTitle(option: ViewOption): string {
        return option.content_object?.getShortName().trim() ?? this.unknownUserLabel;
    }
}
