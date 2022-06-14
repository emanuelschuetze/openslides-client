import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { UntypedFormBuilder } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Identifiable } from 'src/app/domain/interfaces';
import { MotionComment } from 'src/app/domain/models/motions/motion-comment';
import { ViewMotionComment, ViewMotionCommentSection } from 'src/app/site/pages/meetings/pages/motions';
import { ComponentServiceCollectorService } from 'src/app/site/services/component-service-collector.service';

import { MotionCommentControllerService } from '../../../../modules/comments/services/motion-comment-controller.service';
import { MotionPdfExportService } from '../../../../services/export/motion-pdf-export.service/motion-pdf-export.service';
import { BaseMotionDetailActionCardComponent } from '../../base/base-motion-detail-action-card.component';

@Component({
    selector: `os-motion-comment`,
    templateUrl: `./motion-comment.component.html`,
    styleUrls: [`./motion-comment.component.scss`],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MotionCommentComponent extends BaseMotionDetailActionCardComponent {
    @Input()
    public section!: ViewMotionCommentSection;

    @Input()
    public canBeEdited = false;

    @Input()
    public comment?: ViewMotionComment;

    @Input()
    public index!: number;

    protected get sectionId(): string {
        return this.section.id.toString();
    }

    public constructor(
        componentServiceCollector: ComponentServiceCollectorService,
        protected override translate: TranslateService,
        cd: ChangeDetectorRef,
        fb: UntypedFormBuilder,
        private pdfService: MotionPdfExportService,
        private commentRepo: MotionCommentControllerService
    ) {
        super(componentServiceCollector, translate, cd, fb);
    }

    public editComment(): void {
        this.enterEditMode(this.comment?.comment || ``);
    }

    public async saveComment(): Promise<void> {
        if (!this.hasComment()) {
            await this.handleRequest(this.createComment());
        } else if (this.isCommentFormEmpty()) {
            await this.handleRequest(this.deleteComment());
        } else {
            await this.handleRequest(this.updateComment());
        }
        await this.leaveEditMode();
    }

    public hasComment(): boolean {
        return !!this.comment;
    }

    public isCommentFormEmpty(): boolean {
        return this.getTextFromForm() === ``;
    }

    public exportCommentAsPDf(): void {
        this.pdfService.exportComment(this.section, this.motion);
    }

    private createComment(): Promise<Identifiable> {
        return this.commentRepo.create({
            motion_id: this.motion.id,
            section_id: this.section.id,
            comment: this.getTextFromForm()
        });
    }

    private updateComment(): Promise<void> {
        return this.commentRepo.update({ comment: this.getTextFromForm() }, this.comment!);
    }

    private deleteComment(): Promise<void> {
        return this.commentRepo.delete(this.comment!);
    }

    private async handleRequest(request: Promise<any>): Promise<void> {
        return request.catch(error => this.raiseError(`${error} :"${this.section.name}"`));
    }

    protected getStorageIndex(): string {
        return `${MotionComment.COLLECTION}:${this.motion.id}_${this.index}`;
    }
}
