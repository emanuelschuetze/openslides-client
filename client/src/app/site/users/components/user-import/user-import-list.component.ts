import { Component, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

import { columnFactory, PblColumnDefinition } from '@pebula/ngrid';

import { NewEntry } from 'app/core/ui-services/base-import.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { CsvExportService } from 'app/core/ui-services/csv-export.service';
import { User } from 'app/shared/models/users/user';
import { BaseImportListComponent } from 'app/site/base/components/base-import-list.component';
import { UserImportService } from '../../services/user-import.service';
import { headerMap, userHeadersAndVerboseNames } from '../../users.constants';

/**
 * Component for the user import list view.
 */
@Component({
    selector: 'os-user-import-list',
    templateUrl: './user-import-list.component.html',
    styleUrls: ['./user-import-list.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class UserImportListComponent extends BaseImportListComponent<User> {
    public textAreaForm: FormGroup;

    public headerRowDefinition = Object.values(userHeadersAndVerboseNames);

    private statusImportColumn: PblColumnDefinition = {
        label: this.translate.instant('Status'),
        prop: `status`
    };

    private get generateImportColumns(): PblColumnDefinition[] {
        return headerMap.map((property, index: number) => {
            const singleColumnDef: PblColumnDefinition = {
                label: this.translate.instant(userHeadersAndVerboseNames[property]),
                prop: `newEntry.${property}`,
                type: this.guessType(property as keyof User)
            };

            return singleColumnDef;
        });
    }

    public columnSet = columnFactory()
        .default({ minWidth: 150 })
        .table(this.statusImportColumn, ...this.generateImportColumns)
        .build();

    /**
     * Constructor for list view bases
     *
     * @param titleService the title serivce
     * @param matSnackBar snackbar for displaying errors
     * @param formBuilder: FormBuilder for the textArea
     * @param translate the translate service
     * @param exporter: csv export service for dummy data
     * @param importer: The motion csv import service
     */
    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        formBuilder: FormBuilder,
        private exporter: CsvExportService,
        protected importer: UserImportService
    ) {
        super(componentServiceCollector, importer);
        this.textAreaForm = formBuilder.group({ inputtext: [''] });
    }

    /**
     * Triggers an example csv download
     */
    public downloadCsvExample(): void {
        const rows = [
            [
                'Dr.',
                'Max',
                'Mustermann',
                'Berlin',
                1234567890,
                'Delegates, Staff',
                'xyz',
                1,
                1,
                ,
                'initialPassword',
                null,
                'mmustermann',
                'male',
                1.0
            ],
            [
                null,
                'John',
                'Doe',
                'Washington',
                '75/99/8-2',
                'Committees',
                'This is a comment, without doubt',
                1,
                1,
                null,
                null,
                'john.doe@email.com',
                'jdoe',
                'diverse',
                2.0
            ],
            [
                null,
                'Julia',
                'Bloggs',
                'London',
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                'jbloggs',
                'female',
                1.5
            ],
            [null, null, 'Executive Board', null, null, null, null, null, null, 1, null, null, 'executive', null, 2.5]
        ];
        this.exporter.dummyCSVExport(
            Object.values(userHeadersAndVerboseNames),
            rows,
            `${this.translate.instant('participants-example')}.csv`
        );
    }

    /**
     * Guess the type of the property, since
     * `const type = typeof User[property];`
     * always returns undefined
     */
    private guessType(userProperty: keyof User): 'string' | 'number' | 'boolean' {
        const numberProperties: (keyof User)[] = ['id', 'vote_weight'];
        const booleanProperties: (keyof User)[] = ['is_present_in_meeting_ids', 'is_physical_person', 'is_active'];
        if (numberProperties.includes(userProperty)) {
            return 'number';
        } else if (booleanProperties.includes(userProperty)) {
            return 'boolean';
        } else {
            return 'string';
        }
    }

    /**
     * Shorthand for getVerboseError on name fields checking for duplicates and invalid fields
     *
     * @param row
     * @returns an error string similar to getVerboseError
     */
    public nameErrors(row: NewEntry<User>): string {
        for (const name of ['NoName', 'Duplicates', 'DuplicateImport']) {
            if (this.importer.hasError(row, name)) {
                return this.importer.verbose(name);
            }
        }
        return '';
    }

    /**
     * Sends the data in the text field input area to the importer
     */
    public parseTextArea(): void {
        this.importer.parseTextArea(this.textAreaForm.get('inputtext').value);
    }

    /**
     * Triggers a change in the tab group: Clearing the preview selection
     */
    public onTabChange(): void {
        this.importer.clearPreview();
    }
}
