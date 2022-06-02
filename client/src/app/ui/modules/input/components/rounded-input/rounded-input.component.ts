import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, ViewChild } from '@angular/core';
import { forwardRef } from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { BaseFormControlComponent } from 'src/app/ui/base/base-form-control';

/**
 * Type declared to see, which values are possible for some inputs.
 */
export type Size = 'small' | 'medium' | 'large';

@Component({
    selector: `os-rounded-input`,
    templateUrl: `./rounded-input.component.html`,
    styleUrls: [`./rounded-input.component.scss`],
    providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RoundedInputComponent), multi: true }]
})
export class RoundedInputComponent extends BaseFormControlComponent<string> implements OnInit {
    /**
     * Binds the class to the parent-element.
     */
    @HostBinding(`class`)
    public get classes(): string {
        return this.fullWidth ? `full-width` : ``;
    }

    /**
     * Reference to the `<input />`-element.
     */
    @ViewChild(`osInput`, { static: true })
    public osInput!: ElementRef<HTMLInputElement>;

    public get dedicatedContentForm(): FormControl {
        return this.contentForm as FormControl;
    }

    /**
     * Controls the size of the input.
     *
     * Possible values are `'small' | 'medium' | 'large'`.
     * Defaults to `'medium'`.
     */
    @Input()
    public size: Size = `medium`;

    /**
     * Whether this component should render over the full width.
     */
    @Input()
    public fullWidth = false;

    /**
     * Boolean, whether the input should be focussed automatically, if the component enters the DOM.
     */
    @Input()
    public autofocus = false;

    /**
     * Boolean, whether the input should keep the focus, even if it loses the focus.
     */
    @Input()
    public keepFocus = false;

    /**
     * Placeholder for the input. Defaults to `Search...`.
     */
    @Input()
    public placeholder = `Search...`;

    /**
     * Boolean, whether the input will be cleared, if the user presses `Escape`.
     */
    @Input()
    public clearOnEscape = true;

    /**
     * Boolean to indicate, whether the input should have rounded borders at the bottom or not.
     */
    @Input()
    public hasChildren = false;

    /**
     * Boolean to indicate, whether the borders should be rounded with a smaller size.
     */
    @Input()
    public set borderRadiusSize(size: Size) {
        this._borderRadius = size + `-border-radius`;
    }

    /**
     * EventHandler for the input-changes.
     */
    @Output()
    public inputChanged = new EventEmitter<string>();

    /**
     * Getter to get the border-radius as a string.
     *
     * @returns {string} The border-radius as class.
     */
    public get borderRadius(): string {
        return this._borderRadius;
    }

    /**
     * Variable for the border-radius as class.
     */
    private _borderRadius = `large-border-radius`;

    /**
     * Overwrites `OnInit` - initializes the subscription.
     */
    public override ngOnInit(): void {
        super.ngOnInit();
        if (this.autofocus) {
            this.focus();
        }
        this.subscriptions.push(
            this.contentForm.valueChanges.pipe(debounceTime(250)).subscribe(nextValue => {
                this.inputChanged.emit(nextValue);
            })
        );
    }

    /**
     * Function to clear the input and refocus it.
     */
    public clear(event?: MouseEvent): void {
        event?.preventDefault();
        this.contentForm.setValue(``);
    }

    /**
     * Function to programmatically focus the input.
     */
    public focus(): void {
        this.osInput.nativeElement.focus();
    }

    /**
     * Function called, if the input loses its focus.
     */
    public blur(): void {
        if (this.keepFocus) {
            this.focus();
        }
    }

    /**
     * Function to handle typing.
     * Useful to listen to special keys.
     *
     * @param event The `KeyboardEvent`.
     */
    public keyPressed(event: KeyboardEvent): void {
        if (this.clearOnEscape && event.key === `Escape`) {
            this.clear();
        }
    }

    protected createForm(): FormControl {
        return this.fb.control(``);
    }

    protected updateForm(value: string): void {
        this.contentForm.setValue(value);
    }
}
