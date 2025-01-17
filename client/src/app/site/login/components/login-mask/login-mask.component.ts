import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AuthService } from 'app/core/core-services/auth.service';
import { OperatorService } from 'app/core/core-services/operator.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { OrganisationSettingsService } from 'app/core/ui-services/organisation-settings.service';
import { OverlayService } from 'app/core/ui-services/overlay.service';
import { ParentErrorStateMatcher } from 'app/shared/parent-error-state-matcher';
import { BaseComponent } from 'app/site/base/components/base.component';
import { BrowserSupportService } from '../../services/browser-support.service';

/**
 * Login mask component.
 *
 * Handles user and guest login
 */
@Component({
    selector: 'os-login-mask',
    templateUrl: './login-mask.component.html',
    styleUrls: ['./login-mask.component.scss']
})
export class LoginMaskComponent extends BaseComponent implements OnInit, OnDestroy {
    /**
     * Show or hide password and change the indicator accordingly
     */
    public hide: boolean;

    private checkBrowser = true;

    /**
     * Reference to the SnackBarEntry for the installation notice send by the server.
     */
    public installationNotice: string;

    /**
     * Login Error Message if any
     */
    public loginErrorMsg = '';

    /**
     * Form group for the login form
     */
    public loginForm: FormGroup;

    /**
     * Custom Form validation
     */
    public parentErrorStateMatcher = new ParentErrorStateMatcher();

    public operatorSubscription: Subscription | null;

    public samlLoginButtonText: string | null = null;

    /**
     * The message, that should appear, when the user logs in.
     */
    private loginMessage = 'Loading data. Please wait ...';

    /**
     * Constructor for the login component
     *
     * @param authService Authenticating the user
     * @param operator The representation of the current user
     * @param router forward to start page
     * @param formBuilder To build the form and validate
     * @param httpService used to get information before the login
     * @param OpenSlides The Service for OpenSlides
     * @param orgaSettings provide information about the legal notice and privacy policy
     * @param overlayService Service to show the spinner when the user is signing in
     */
    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        private authService: AuthService,
        private operator: OperatorService,
        private router: Router,
        private route: ActivatedRoute,
        private formBuilder: FormBuilder,
        private orgaSettings: OrganisationSettingsService,
        private overlayService: OverlayService,
        private browserSupport: BrowserSupportService
    ) {
        super(componentServiceCollector);
        // Hide the spinner if the user is at `login-mask`
        this.createForm();
    }

    /**
     * Init.
     *
     * Set the title to "Log In"
     * Observes the operator, if a user was already logged in, recreate to user and skip the login
     */
    public ngOnInit(): void {
        this.subscriptions.push(
            this.orgaSettings.get('login_text').subscribe(notice => (this.installationNotice = notice))
        );

        this.subscriptions
            .push // TODO: SAML
            // this.orgaSettings.get('saml').subscribe(
            //     samlSettings => (this.samlLoginButtonText = samlSettings ? samlSettings.loginButtonText : null)
            // )
            ();

        // Maybe the operator changes and the user is logged in. If so, redirect him and boot OpenSlides.
        this.operatorSubscription = this.operator.operatorUpdatedEvent.subscribe(user => {
            if (user) {
                this.clearOperatorSubscription();
                this.authService.redirectUser();
            }
        });

        this.route.queryParams.pipe(filter(params => params.checkBrowser)).subscribe(params => {
            this.checkBrowser = params.checkBrowser === 'true';
        });

        if (this.checkBrowser) {
            this.checkDevice();
        }
    }

    /**
     * Clear the subscription on destroy.
     */
    public ngOnDestroy(): void {
        super.ngOnDestroy();
        this.clearOperatorSubscription();
    }

    private checkDevice(): void {
        if (!this.browserSupport.isBrowserSupported()) {
            this.router.navigate(['./unsupported-browser'], { relativeTo: this.route });
        }
    }

    /**
     * Clears the subscription to the operator.
     */
    private clearOperatorSubscription(): void {
        if (this.operatorSubscription) {
            this.operatorSubscription.unsubscribe();
            this.operatorSubscription = null;
        }
    }

    /**
     * Create the login Form
     */
    public createForm(): void {
        this.loginForm = this.formBuilder.group({
            username: ['', [Validators.required, Validators.maxLength(128)]],
            password: ['', [Validators.required, Validators.maxLength(128)]]
        });
    }

    /**
     * Actual login function triggered by the form.
     *
     * Send username and password to the {@link AuthService}
     */
    public async formLogin(/*authType: UserAuthType*/): Promise<void> {
        this.loginErrorMsg = '';
        try {
            // this.overlayService.logout(); // Ensures displaying spinner, if logging in
            // this.overlayService.showSpinner(this.translate.instant(this.loginMessage), true);
            await this.authService.login(this.loginForm.value.username, this.loginForm.value.password);
        } catch (e) {
            // this.overlayService.hideSpinner();
            this.loginForm.get('password').setErrors({ notFound: true });
            this.loginErrorMsg = e;
        }
        // throw new Error('TODO'); // Ingore SAML for now...
    }

    /**
     * Go to the reset password view
     */
    public resetPassword(): void {
        this.router.navigate(['./reset-password'], { relativeTo: this.route });
    }
}
