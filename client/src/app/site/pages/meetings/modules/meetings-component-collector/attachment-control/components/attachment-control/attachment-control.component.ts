import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    forwardRef,
    OnInit,
    Output,
    TemplateRef
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';
import { BaseFormControlComponent } from 'src/app/ui/base/base-form-control';
import { ViewMediafile } from 'src/app/site/pages/meetings/pages/mediafiles';
import { Permission } from 'src/app/domain/definitions/permission';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { map, Observable, OperatorFunction } from 'rxjs';
import { mediumDialogSettings } from 'src/app/infrastructure/utils/dialog-settings';
import { MediafileControllerService } from 'src/app/site/pages/meetings/pages/mediafiles/services/mediafile-controller.service';

@Component({
    selector: `os-attachment-control`,
    templateUrl: `./attachment-control.component.html`,
    styleUrls: [`./attachment-control.component.scss`],
    providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AttachmentControlComponent), multi: true }],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttachmentControlComponent extends BaseFormControlComponent<ViewMediafile[]> implements OnInit {
    /**
     * Output for an error handler
     */
    @Output()
    public errorHandler: EventEmitter<string> = new EventEmitter();

    public readonly permission = Permission;

    private dialogRef: MatDialogRef<any> | null = null;

    /**
     * The file list that is necessary for the `SearchValueSelector`
     */
    public mediaFileList: Observable<ViewMediafile[]> | null = null;

    public get empty(): boolean {
        return !this.contentForm.value.length;
    }
    public get controlType(): string {
        return `attachment-control`;
    }

    public formGroup!: FormGroup;

    public constructor(
        formBuilder: FormBuilder,
        private dialogService: MatDialog,
        public readonly repo: MediafileControllerService
    ) {
        super(formBuilder);
    }

    public override ngOnInit(): void {
        this.subscriptions.push(
            this.formGroup.get(`mediafile_ids`)!.valueChanges.subscribe(value => {
                this.push(value);
            })
        );
    }

    public getMediafilesPipeFn(): OperatorFunction<ViewMediafile[], ViewMediafile[]> {
        return map(mediafiles => mediafiles.filter(mediafile => !mediafile.is_directory));
    }

    /**
     * Function to open a given dialog
     *
     * @param dialog the dialog to open
     */
    public openUploadDialog(dialog: TemplateRef<string>): void {
        this.dialogRef = this.dialogService.open(dialog, { ...mediumDialogSettings, disableClose: false });
    }

    /**
     * Function to set the value for the `SearchValueSelector` after successful upload
     *
     * @param fileIDs a list with the ids of the uploaded files
     */
    public uploadSuccess(fileIDs: number[]): void {
        const newValues = [...this.contentForm.value, ...fileIDs];
        this.updateForm(newValues);
        this.dialogRef?.close();
    }

    /**
     * Function to emit an occurring error.
     *
     * @param error The occurring error
     */
    public uploadError(error: string): void {
        this.errorHandler.emit(error);
    }

    protected createForm(): FormControl | FormGroup {
        this.formGroup = this.fb.group({ mediafile_ids: [] });
        return this.fb.control([]);
    }

    protected override initializeForm(): void {
        this.contentForm = this.fb.control([]);
        this.formGroup = this.fb.group({
            mediafile_ids: []
        });
    }

    protected updateForm(value: ViewMediafile[] | null): void {
        this.contentForm.setValue(value ?? []);
        this.formGroup.patchValue({
            mediafile_ids: value ?? []
        });
    }
}