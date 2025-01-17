import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';

import { Id } from 'app/core/definitions/key-types';
import { BaseDecimalModel } from '../base/base-decimal-model';
import { HasProjectionIds } from '../base/has-projectable-ids';

/**
 * Iterable pre selection of genders (sexes)
 */
export const genders = [_('female'), _('male'), _('diverse')];

/**
 * Representation of a user in contrast to the operator.
 * @ignore
 */
export class User extends BaseDecimalModel<User> {
    public static COLLECTION = 'user';

    public id: Id;
    public username: string;
    public title: string;
    public first_name: string;
    public last_name: string;
    public is_active: boolean;
    public is_physical_person: boolean;
    public default_password?: string;
    public gender?: string;
    public comment_$: string[];
    public number_$: string[];
    public about_me_$: string[];
    public default_number: string;
    public default_structure_level: string;
    public structure_level_$: string[];
    public email?: string;
    public last_email_send?: string; // ISO datetime string
    public vote_weight_$: number[];
    public default_vote_weight: number;
    public is_demo_user: boolean;

    public role_id?: Id; // role/user_ids;

    // Meeting and committee
    public is_present_in_meeting_ids: Id[]; // (meeting/present_user_ids)[];
    public meeting_id?: Id; // meeting/temporary_user_ids;  // Temporary users
    public guest_meeting_ids: Id[]; // (meeting/guest_ids)[];  // Guests in meetings
    public committee_as_member_ids: Id[]; // (committee/member_ids)[];
    public committee_as_manager_ids: Id[]; // (committee/manager_ids)[];

    public group_$_ids: string[]; // (group/user_ids)[];
    public speaker_$_ids: string[]; // (speaker/user_id)[];
    public personal_note_$_ids: string[]; // (personal_note/user_id)[];
    public supported_motion_$_ids: string[]; // (motion/supporter_ids)[];
    public submitted_motion_$_ids: string[]; // (motion_submitter/user_id)[];
    public poll_voted_$_ids: string[]; // (poll/voted_ids)[];
    public vote_$_ids: string[]; // (vote/user_id)[];
    public delegated_vote_$_ids: string[]; // (vote/delegated_user_id)[];
    public option_$_ids: string[];
    public assignment_candidate_$_ids: string[]; // (assignment_candidate/user_id)[];
    public vote_delegated_$_vote_ids: string[];
    public vote_delegated_$_to_id: string[]; // user/vote_delegated_$<meeting_id>_from_ids;
    public vote_delegations_$_from_ids: string[]; // user/vote_delegated_$<meeting_id>_to_id;

    public projection_$_ids: any[];
    public current_projector_$_ids: any[];

    public organisation_management_level: string;

    public get isVoteWeightOne(): boolean {
        return this.default_vote_weight === 1;
    }

    public get isVoteRightDelegated(): boolean {
        return !!this.vote_delegated_to_id(this.meeting_id);
    }

    public get isTemporary(): boolean {
        return !!this.meeting_id;
    }

    public constructor(input?: Partial<User>) {
        super(User.COLLECTION, input);
    }

    public hasVoteRightFromOthers(meetingId: Id): boolean {
        return this.vote_delegations_from_ids(meetingId)?.length > 0;
    }

    public vote_weight(meetingId: Id): number {
        return this[`vote_weight_$${[meetingId]}`] || this.default_vote_weight;
    }

    public structure_level(meetingId: Id): string {
        return this[`structure_level_$${meetingId}`] || this.default_structure_level;
    }

    public number(meetingId: Id): string {
        return this[`number_$${meetingId}`] || this.default_number;
    }

    public about_me(meetingId: Id): string {
        return this[`about_me_$${meetingId}`];
    }

    public comment(meetingId: Id): string {
        return this[`comment_$${meetingId}`];
    }

    public group_ids(meetingId: Id): Id[] {
        return this[`group_$${meetingId}_ids`] || [];
    }

    public speaker_ids(meetingId: Id): Id[] {
        return this[`speaker_$${meetingId}_ids`] || [];
    }

    public personal_note_ids(meetingId: Id): Id[] {
        return this[`personal_note_$${meetingId}_ids`] || [];
    }

    public supported_motion_ids(meetingId: Id): Id[] {
        return this[`supported_motion_$${meetingId}_ids`] || [];
    }

    public submitted_motion_ids(meetingId: Id): Id[] {
        return this[`submitted_motion_$${meetingId}_ids`] || [];
    }

    public motion_poll_voted_ids(meetingId: Id): Id[] {
        return this[`motion_poll_voted_$${meetingId}_ids`] || [];
    }

    public motion_vote_ids(meetingId: Id): Id[] {
        return this[`motion_vote_$${meetingId}_ids`] || [];
    }

    public motion_delegated_vote_ids(meetingId: Id): Id[] {
        return this[`motion_delegated_vote_$${meetingId}_ids`] || [];
    }

    public assignment_candidate_ids(meetingId: Id): Id[] {
        return this[`assignment_candidate_$${meetingId}_ids`] || [];
    }

    public assignment_poll_voted_ids(meetingId: Id): Id[] {
        return this[`assignment_poll_voted_$${meetingId}_ids`] || [];
    }

    public assignment_option_ids(meetingId: Id): Id[] {
        return this[`assignment_option_$${meetingId}_ids`] || [];
    }

    public assignment_vote_ids(meetingId: Id): Id[] {
        return this[`assignment_vote_$${meetingId}_ids`] || [];
    }

    public assignment_delegated_vote_ids(meetingId: Id): Id[] {
        return this[`assignment_delegated_vote_$${meetingId}_ids`] || [];
    }

    public vote_delegated_to_id(meetingId: Id): Id {
        return this[`vote_delegated_$${meetingId}_to_id`];
    }

    public vote_delegations_from_ids(meetingId: Id): Id[] {
        return this[`vote_delegations_$${meetingId}_from_ids`] || [];
    }

    protected getDecimalFields(): (keyof User)[] {
        return ['vote_weight_$', 'default_vote_weight'];
    }
}
export interface User extends HasProjectionIds {}
