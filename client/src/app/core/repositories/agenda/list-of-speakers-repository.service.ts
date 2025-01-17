import { Injectable } from '@angular/core';

import { ListOfSpeakersAction } from 'app/core/actions/list-of-speakers-action';
import { DEFAULT_FIELDSET, Fieldsets } from 'app/core/core-services/model-request-builder.service';
import { ListOfSpeakers } from 'app/shared/models/agenda/list-of-speakers';
import { ViewListOfSpeakers } from 'app/site/agenda/models/view-list-of-speakers';
import { ViewSpeaker } from 'app/site/agenda/models/view-speaker';
import { BaseRepositoryWithActiveMeeting } from '../base-repository-with-active-meeting';
import { RepositoryServiceCollector } from '../repository-service-collector';

/**
 * An object, that contains information about structure-level,
 * speaking-time and finished-speakers.
 * Helpful to get a relation between speakers and their structure-level.
 */
export interface SpeakingTimeStructureLevelObject {
    structureLevel: string;
    finishedSpeakers: ViewSpeaker[];
    speakingTime: number;
}

/**
 * Repository service for lists of speakers
 *
 * Documentation partially provided in {@link BaseRepository}
 */
@Injectable({
    providedIn: 'root'
})
export class ListOfSpeakersRepositoryService extends BaseRepositoryWithActiveMeeting<
    ViewListOfSpeakers,
    ListOfSpeakers
> {
    public constructor(repositoryServiceCollector: RepositoryServiceCollector) {
        super(repositoryServiceCollector, ListOfSpeakers);
    }

    public getFieldsets(): Fieldsets<ListOfSpeakers> {
        return { [DEFAULT_FIELDSET]: ['closed', 'content_object_id', 'speaker_ids'] };
    }

    public getVerboseName = (plural: boolean = false) => {
        return this.translate.instant(plural ? 'Lists of speakers' : 'List of speakers');
    };

    public getTitle = (viewListOfSpeakers: ViewListOfSpeakers) => {
        if (viewListOfSpeakers.content_object) {
            return viewListOfSpeakers.content_object.getListOfSpeakersTitle();
        }
    };

    public async closeListOfSpeakers(listOfSpeakers: ViewListOfSpeakers): Promise<void> {
        const payload: ListOfSpeakersAction.UpdatePayload = { id: listOfSpeakers.id, closed: true };
        return await this.sendActionToBackend(ListOfSpeakersAction.UPDATE, payload);
    }

    public async reopenListOfSpeakers(listOfSpeakers: ViewListOfSpeakers): Promise<void> {
        const payload: ListOfSpeakersAction.UpdatePayload = { id: listOfSpeakers.id, closed: false };
        return await this.sendActionToBackend(ListOfSpeakersAction.UPDATE, payload);
    }

    /**
     * Deletes all speakers of the given list of speakers.
     *
     * @param listOfSpeakers the target list of speakers
     */
    public async deleteAllSpeakers(listOfSpeakers: ViewListOfSpeakers): Promise<void> {
        const payload: ListOfSpeakersAction.DeleteAllSpeakersPayload = {
            id: listOfSpeakers.id
        };
        return await this.sendActionToBackend(ListOfSpeakersAction.DELETE_ALL_SPEAKERS, payload);
    }

    /**
     * Readds the last speaker to the list of speakers
     *
     * @param listOfSpeakers the list of speakers to modify
     */
    public async readdLastSpeaker(listOfSpeakers: ViewListOfSpeakers): Promise<void> {
        const payload: ListOfSpeakersAction.ReAddLastPayload = {
            id: listOfSpeakers.id
        };
        return await this.sendActionToBackend(ListOfSpeakersAction.RE_ADD_LAST_SPEAKER, payload);
    }

    public isFirstContribution(speaker: ViewSpeaker): boolean {
        return !this.getViewModelList().some(list => list.hasSpeakerSpoken(speaker));
    }

    /**
     * List every speaker only once, who has spoken
     *
     * @returns A list with all different speakers.
     */
    public getAllFirstContributions(): ViewSpeaker[] {
        const speakers: ViewSpeaker[] = this.getViewModelList().flatMap(
            (los: ViewListOfSpeakers) => los.finishedSpeakers
        );
        const firstContributions: ViewSpeaker[] = [];
        for (const speaker of speakers) {
            if (!firstContributions.find(s => s.user_id === speaker.user_id)) {
                firstContributions.push(speaker);
            }
        }
        return firstContributions;
    }

    /**
     * Maps structure-level to speaker.
     *
     * @returns A list, which entries are `SpeakingTimeStructureLevelObject`.
     */
    public getSpeakingTimeStructureLevelRelation(): SpeakingTimeStructureLevelObject[] {
        let listSpeakingTimeStructureLevel: SpeakingTimeStructureLevelObject[] = [];
        for (const los of this.getViewModelList()) {
            for (const speaker of los.finishedSpeakers) {
                const nextEntry = this.getSpeakingTimeStructureLevelObject(speaker);
                listSpeakingTimeStructureLevel = this.getSpeakingTimeStructureLevelList(
                    nextEntry,
                    listSpeakingTimeStructureLevel
                );
            }
        }
        return listSpeakingTimeStructureLevel;
    }

    /**
     * Helper-function to create a `SpeakingTimeStructureLevelObject` by a given speaker.
     *
     * @param speaker, with whom structure-level and speaking-time is calculated.
     *
     * @returns The created `SpeakingTimeStructureLevelObject`.
     */
    private getSpeakingTimeStructureLevelObject(speaker: ViewSpeaker): SpeakingTimeStructureLevelObject {
        return {
            structureLevel:
                !speaker.user || (speaker.user && !speaker.user.structure_level())
                    ? '–'
                    : speaker.user.structure_level(),
            finishedSpeakers: [speaker],
            speakingTime: this.getSpeakingTimeAsNumber(speaker)
        };
    }

    /**
     * Helper-function to update entries in a given list, if already existing, or create entries otherwise.
     *
     * @param object A `SpeakingTimeStructureLevelObject`, that contains information about speaking-time
     * and structure-level.
     * @param list A list, at which speaking-time, structure-level and finished_speakers are set.
     *
     * @returns The updated map.
     */
    private getSpeakingTimeStructureLevelList(
        object: SpeakingTimeStructureLevelObject,
        list: SpeakingTimeStructureLevelObject[]
    ): SpeakingTimeStructureLevelObject[] {
        const index = list.findIndex(entry => entry.structureLevel === object.structureLevel);
        if (index >= 0) {
            list[index].speakingTime += object.speakingTime;
            list[index].finishedSpeakers.push(...object.finishedSpeakers);
        } else {
            list.push(object);
        }
        return list;
    }

    /**
     * This function calculates speaking-time as number for a given speaker.
     *
     * @param speaker The speaker, whose speaking-time should be calculated.
     *
     * @returns A number, that represents the speaking-time.
     */
    private getSpeakingTimeAsNumber(speaker: ViewSpeaker): number {
        return Math.floor((new Date(speaker.end_time).valueOf() - new Date(speaker.begin_time).valueOf()) / 1000);
    }
}
