import { Injectable } from '@angular/core';

import { TranslateDefaultParser, TranslateStore } from '@ngx-translate/core';

import { CustomTranslations, CustomTranslationService } from './custom-translation.service';

/**
 * Custom translate parser. Intercepts and use custom translations from the organisation settings service.
 */
@Injectable()
export class OpenSlidesTranslateParser extends TranslateDefaultParser {
    /**
     * Saves the custom translations retrieved from the config service
     */
    private customTranslations: CustomTranslations = [];

    /**
     * Subscribes to the custom translations and watches for updated custom translations.
     */
    public constructor(ctService: CustomTranslationService, private translateStore: TranslateStore) {
        super();

        ctService.customTranslationSubject.subscribe(ct => {
            if (!ct) {
                ct = [];
            }
            this.customTranslations = ct;
            // trigger reload of all languages. This does not hurt performance,
            // in fact the directives and pipes just listen to the selected language.
            this.translateStore.langs.forEach(lang => {
                this.translateStore.onTranslationChange.emit({
                    lang: lang,
                    translations: this.translateStore.translations[lang]
                });
            });
        });
    }

    /**
     * Here, we actually intercept getting translations. This method is called from the
     * TranslateService trying to retrieve a translation to the key.
     *
     * Here, the translation is searched and then overwritten by our custom translations, if
     * the value exist.
     *
     * @param target The translation dict
     * @param key The key to find the translation
     */
    public getValue(target: any, key: string): any {
        const translation = super.getValue(target, key);
        const customTranslation = this.customTranslations.find(c => c.original === translation);
        if (customTranslation) {
            return customTranslation.translation;
        } else {
            return translation;
        }
    }
}
