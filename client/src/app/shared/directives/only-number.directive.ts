import { Directive, HostListener, Input } from '@angular/core';

@Directive({
    selector: '[osOnlyNumber]'
})
export class OnlyNumberDirective {
    @Input()
    public osOnlyNumber = true;

    /**
     * Regex to validate only numbers
     * ^: starts with
     * $: ends
     */
    private regExp = new RegExp('^([1-9][0-9]*|0)?$');

    private allowedCharacters = [
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        'Backspace',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown'
    ];

    @HostListener('keydown', ['$event'])
    public onKeyDown(event: KeyboardEvent): void {
        if (this.osOnlyNumber) {
            if (
                this.allowedCharacters.includes(event.key) ||
                // Allow: Ctrl+A
                (event.key === 'a' && event.ctrlKey) ||
                // Allow: Ctrl+C
                (event.key === 'c' && event.ctrlKey) ||
                // Allow: Ctrl+V
                (event.key === 'v' && event.ctrlKey) ||
                // Allow: Ctrl+X
                (event.key === 'x' && event.ctrlKey)
            ) {
                // let it happen, don't do anything
                return;
            }
            if (this.regExp.test(event.key)) {
                return;
            } else {
                event.preventDefault();
            }
        }
    }
}
