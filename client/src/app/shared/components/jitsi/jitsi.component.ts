import { animate, state, style, transition, trigger } from '@angular/animations';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';

import { StorageMap } from '@ngx-pwa/local-storage';

import { OperatorService } from 'app/core/core-services/operator.service';
import { Deferred } from 'app/core/promises/deferred';
import { UserRepositoryService } from 'app/core/repositories/users/user-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { UserMediaPermService } from 'app/core/ui-services/user-media-perm.service';
import { BaseComponent } from 'app/site/base/components/base.component';
import { CurrentListOfSpeakersService } from 'app/site/projector/services/current-list-of-speakers.service';

declare var JitsiMeetExternalAPI: any;

interface JitsiMember {
    id: string;
    displayName: string;
}

interface ConferenceJoinedResult {
    roomName: string;
    id: string;
    displayName: string;
    formattedDisplayName: string;
}

interface DisplayNameChangeResult {
    // Yes, in this case "displayname" really does not have a capital n. Thank you jitsi.
    displayname: string;
    formattedDisplayName: string;
    id: string;
}

interface JitsiSettings {
    JITSI_DOMAIN: string;
    JITSI_ROOM_NAME: string;
    JITSI_ROOM_PASSWORD: string;
}

interface ConferenceMember {
    name: string;
    focus: boolean;
}

enum ConferenceState {
    stream,
    jitsi
}

@Component({
    selector: 'os-jitsi',
    templateUrl: './jitsi.component.html',
    styleUrls: ['./jitsi.component.scss'],
    animations: [
        trigger('fadeInOut', [
            state(
                'true',
                style({
                    opacity: 1
                })
            ),
            state(
                'false',
                style({
                    opacity: 0.2
                })
            ),
            transition('true <=> false', animate('1s'))
        ])
    ],
    encapsulation: ViewEncapsulation.None
})
export class JitsiComponent extends BaseComponent implements OnInit, OnDestroy {
    public enableJitsi: boolean;

    private autoconnect: boolean;
    private roomName: string;
    private roomPassword: string;
    private jitsiDomain: string;

    public restricted = false;
    public videoStreamUrl: string;
    private nextSpeakerAmount: number;

    // do not set the password twice
    private isPasswortSet = false;

    public isJitsiDialogOpen = false;
    public showJitsiWindow = true;
    public muted = true;

    @ViewChild('jitsi')
    private jitsiNode: ElementRef;

    // JitsiMeet api object
    private api: any | null;

    public get isJitsiActive(): boolean {
        return !!this.api;
    }

    public isJoined: boolean;
    public streamRunning: boolean;

    private options: object;

    private lockLoaded: Deferred<void> = new Deferred();
    private constantsLoaded: Deferred<void> = new Deferred();
    private configsLoaded: Deferred<void> = new Deferred();

    // storage locks
    public isJitsiActiveInAnotherTab = false;
    public streamActiveInAnotherTab = false;

    private RTC_LOGGED_STORAGE_KEY = 'rtcIsLoggedIn';
    private STREAM_RUNNING_STORAGE_KEY = 'streamIsRunning';

    // JitsiID to ConferenceMember
    public members = {};
    public currentDominantSpeaker: JitsiMember;

    public get memberList(): string[] {
        return Object.keys(this.members);
    }

    public get isRoomPasswordProtected(): boolean {
        return this.roomPassword?.length > 0;
    }

    private isOnCurrentLos: boolean;

    public canSeeLiveStream: boolean;

    public canManageSpeaker: boolean;

    /**
     * Jitsi|URL|Perm||Show
     * =====|===|====||====
     *   0  | 0 |  0 || 0
     *   0  | 0 |  1 || 0
     *   0  | 1 |  0 || 0
     *   0  | 1 |  1 || 1
     *   1  | 0 |  0 || 1
     *   1  | 0 |  1 || 1
     *   1  | 1 |  0 || 0
     *   1  | 1 |  1 || 1
     */
    public get showConferenceBar(): boolean {
        if (this.enableJitsi) {
            if (this.videoStreamUrl && !this.canSeeLiveStream) {
                return false;
            } else {
                return true;
            }
        } else {
            return this.videoStreamUrl && this.canSeeLiveStream;
        }
    }

    public get isAccessPermitted(): boolean {
        return !this.restricted || this.canManageSpeaker || this.isOnCurrentLos;
    }

    public get jitsiMeetUrl(): string {
        return `https://${this.jitsiDomain}/${this.roomName}`;
    }

    /**
     * The conference state, to determine if the user consumes the stream or can
     * contribute to jitsi
     */
    public state = ConferenceState;
    public currentState: ConferenceState;
    public isEnterMeetingRoomVisible = true;

    private configOverwrite = {
        startAudioOnly: false,
        // allows jitsi on mobile devices
        disableDeepLinking: true,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        useNicks: true,
        enableWelcomePage: false,
        enableUserRolesBasedOnToken: false,
        enableFeaturesBasedOnToken: false,
        disableThirdPartyRequests: true,
        enableNoAudioDetection: false,
        enableNoisyMicDetection: false
    };

    private interfaceConfigOverwrite = {
        DISABLE_VIDEO_BACKGROUND: true,
        INVITATION_POWERED_BY: false,
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        DISABLE_PRESENCE_STATUS: true,
        TOOLBAR_ALWAYS_VISIBLE: true,
        TOOLBAR_TIMEOUT: 10000000,
        TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'desktop',
            'fullscreen',
            'fodeviceselection',
            'profile',
            'chat',
            'recording',
            'livestreaming',
            'etherpad',
            'sharedvideo',
            'settings',
            'videoquality',
            'filmstrip',
            'feedback',
            'stats',
            'shortcuts',
            'tileview',
            'download',
            'help',
            'mute-everyone'
        ]
    };

    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        private operator: OperatorService,
        private storageMap: StorageMap,
        private userRepo: UserRepositoryService,
        /*private constantsService: ConstantsService,
        private configService: ConfigService,*/
        private closService: CurrentListOfSpeakersService,
        private userMediaPermService: UserMediaPermService
    ) {
        super(componentServiceCollector);
    }

    public async ngOnInit(): Promise<void> {
        await this.setUp();
        if (this.canSeeLiveStream && this.videoStreamUrl) {
            this.currentState = ConferenceState.stream;
        } else {
            this.currentState = ConferenceState.jitsi;
        }
    }

    /*public async ngOnDestroy(): Promise<void> {
        super.ngOnDestroy();
        this.stopConference();
    }

    // closing the tab should also try to stop jitsi.
    // this will usually not be cought by ngOnDestroy
    @HostListener('window:beforeunload', ['$event'])
    public async beforeunload($event: any): Promise<void> {
        await this.stopConference();
    }

    public triggerMeetingRoomButtonAnimation(): void {
        if (this.canManageSpeaker) {
            this.isEnterMeetingRoomVisible = true;
        } else {
            this.isEnterMeetingRoomVisible = !this.isEnterMeetingRoomVisible;
        }
    }

    private async stopConference(): Promise<void> {
        await this.stopJitsi();
        if (this.streamActiveInAnotherTab && this.streamRunning) {
            await this.deleteStreamingLock();
        }
    }*/

    private async setUp(): Promise<void> {
        /*this.subscriptions.push(
            // if the operators users has changes, check if we have to start the animation
            this.operator
                .getUserObservable()
                .pipe(delay(0))
                .subscribe(() => {
                    this.canManageSpeaker = this.operator.hasPerms(this.permission.agendaItemCanManageListOfSpeakers);
                    this.canSeeLiveStream = this.operator.hasPerms(this.permission.coreCanSeeLiveStream);
                    this.isEnterMeetingRoomVisible = this.canManageSpeaker;
                }),

            this.storageMap
                .watch(this.RTC_LOGGED_STORAGE_KEY)
                .pipe(distinctUntilChanged())
                .subscribe((inUse: boolean) => {
                    this.isJitsiActiveInAnotherTab = inUse;
                    this.lockLoaded.resolve();
                    if (!inUse && !this.isJitsiActive) {
                        this.startJitsi();
                    }
                }),
            this.storageMap
                .watch(this.STREAM_RUNNING_STORAGE_KEY)
                .pipe(distinctUntilChanged())
                .subscribe((running: boolean) => {
                    this.streamActiveInAnotherTab = running;
                })
        );

        await this.lockLoaded;*/
        console.log('Jitsi: TODO');
        /*this.constantsService.get<JitsiSettings>('Settings').subscribe(settings => {
            if (settings) {
                this.jitsiDomain = settings.JITSI_DOMAIN;
                this.roomName = settings.JITSI_ROOM_NAME;
                this.roomPassword = settings.JITSI_ROOM_PASSWORD;
                this.constantsLoaded.resolve();
            }
        });

        await this.constantsLoaded;

        this.subscriptions.push(
            this.configService
                .get<boolean>('general_system_conference_auto_connect')
                .subscribe(autoconnect => (this.autoconnect = autoconnect)),
            this.configService.get<boolean>('general_system_conference_show').subscribe(show => {
                this.enableJitsi = show && !!this.jitsiDomain && !!this.roomName;
                if (this.enableJitsi && this.autoconnect) {
                    this.startJitsi();
                } else {
                    this.stopJitsi();
                }
            }),
            this.configService.get<boolean>('general_system_conference_los_restriction').subscribe(restricted => {
                this.restricted = restricted;
            }),
            this.configService
                .get<number>('general_system_conference_auto_connect_next_speakers')
                .subscribe(nextSpeakerAmount => {
                    this.nextSpeakerAmount = nextSpeakerAmount;
                }),
            this.configService.get<string>('general_system_stream_url').subscribe(url => {
                this.onLiveStreamAvailable(url);
                this.configsLoaded.resolve();
            }),
            this.configService.get<boolean>('general_system_conference_open_microphone').subscribe(open => {
                this.configOverwrite.startWithAudioMuted = !open;
            }),
            this.configService.get<boolean>('general_system_conference_open_video').subscribe(open => {
                this.configOverwrite.startWithVideoMuted = !open;
            })
        );

        await this.configsLoaded;

        this.subscriptions.push(
            // check if the operator is on the clos, remove from room if not permitted
            this.closService.currentListOfSpeakersObservable
                .pipe(
                    map(los => los?.findUserIndexOnList(this.operator.user.id) ?? -1),
                    distinctUntilChanged()
                )
                .subscribe(userLosIndex => this.autoJoinJitsiByLosIndex(userLosIndex))
        );*/
    }

    public toggleMute(): void {
        if (this.isJitsiActive) {
            this.api.executeCommand('toggleAudio');
        }
    }

    public async forceStart(): Promise<void> {
        await this.deleteJitsiLock();
        await this.stopJitsi();
        await this.startJitsi();
    }

    private startJitsi(): void {
        if (!this.isJitsiActiveInAnotherTab && this.enableJitsi && !this.isJitsiActive && this.jitsiNode) {
            this.enterConversation();
        }
    }

    public async enterConversation(): Promise<void> {
        /*await this.operator.loaded;
        try {
            await this.userMediaPermService.requestMediaAccess();
            this.storageMap.set(this.RTC_LOGGED_STORAGE_KEY, true).subscribe(() => {});
            this.setConferenceState(ConferenceState.jitsi);
            this.setOptions();
            this.api = new JitsiMeetExternalAPI(this.jitsiDomain, this.options);

            const jitsiname = this.userRepo.getShortName(this.operator.user);
            this.api.executeCommand('displayName', jitsiname);
            this.loadApiCallbacks();
        } catch (e) {
            this.raiseError(e);
        }*/
    }

    private loadApiCallbacks(): void {
        this.api.on('videoConferenceJoined', (info: ConferenceJoinedResult) => {
            this.onEnterConference(info);
        });

        this.api.on('participantJoined', (newMember: JitsiMember) => {
            this.addMember(newMember);
        });

        this.api.on('participantLeft', (oldMember: { id: string }) => {
            this.removeMember(oldMember);
        });

        this.api.on('displayNameChange', (member: DisplayNameChangeResult) => {
            this.renameMember(member);
        });

        this.api.on('audioMuteStatusChanged', (isMuted: { muted: boolean }) => {
            this.muted = isMuted.muted;
        });

        this.api.on('readyToClose', () => {
            this.stopJitsi();
        });

        this.api.on('dominantSpeakerChanged', (newSpeaker: { id: string }) => {
            this.newDominantSpeaker(newSpeaker.id);
        });

        this.api.on('passwordRequired', () => {
            this.setRoomPassword();
        });
    }

    private onEnterConference(info: ConferenceJoinedResult): void {
        this.isJoined = true;
        this.addMember({ displayName: info.displayName, id: info.id });
        this.setRoomPassword();
        if (this.videoStreamUrl) {
            this.showJitsiDialog();
        }
    }

    /*private autoJoinJitsiByLosIndex(operatorClosIndex: number): void {
        if (operatorClosIndex !== UserListIndexType.NotOnList) {
            if (!this.isOnCurrentLos) {
                this.isOnCurrentLos = true;
                this.triggerMeetingRoomButtonAnimation();
            }

            if (
                this.nextSpeakerAmount &&
                this.nextSpeakerAmount > 0 &&
                operatorClosIndex > UserListIndexType.Active &&
                operatorClosIndex <= this.nextSpeakerAmount &&
                !this.isJitsiActive
            ) {
                this.enterConversation();
            }
        } else {
            this.isOnCurrentLos = false;
        }

        if (!this.isAccessPermitted) {
            this.viewStream();
        }
    }*/

    private setRoomPassword(): void {
        if (this.roomPassword && !this.isPasswortSet) {
            // You can only set the password after the server has recognized that you are
            // the moderator. There is no event listener for that.
            setTimeout(() => {
                this.api.executeCommand('password', this.roomPassword);
                this.isPasswortSet = true;
            }, 1000);
        }
    }

    private newDominantSpeaker(newSpeakerId: string): void {
        if (this.currentDominantSpeaker && this.members[this.currentDominantSpeaker.id]) {
            this.members[this.currentDominantSpeaker.id].focus = false;
        }
        this.members[newSpeakerId].focus = true;
        this.currentDominantSpeaker = {
            id: newSpeakerId,
            displayName: this.members[newSpeakerId].name
        };
    }

    private addMember(newMember: JitsiMember): void {
        this.members[newMember.id] = {
            name: newMember.displayName,
            focus: false
        } as ConferenceMember;
    }

    private removeMember(oldMember: { id: string }): void {
        if (this.members[oldMember.id]) {
            delete this.members[oldMember.id];
        }
    }

    private renameMember(member: DisplayNameChangeResult): void {
        if (this.members[member.id]) {
            this.members[member.id].name = member.displayname;
        }
        if (this.currentDominantSpeaker?.id === member.id) {
            this.newDominantSpeaker(member.id);
        }
    }

    private clearMembers(): void {
        this.members = {};
    }

    public async stopJitsi(): Promise<void> {
        if (this.isJitsiActive) {
            this.api.executeCommand('hangup');
            this.clearMembers();
            await this.deleteJitsiLock();
            this.api.dispose();
            this.api = undefined;
            this.hideJitsiDialog();
        }
        this.isJoined = false;
        this.isPasswortSet = false;
        this.currentDominantSpeaker = null;
    }

    private setOptions(): void {
        this.options = {
            roomName: this.roomName,
            parentNode: this.jitsiNode.nativeElement,
            configOverwrite: this.configOverwrite,
            interfaceConfigOverwrite: this.interfaceConfigOverwrite
        };
    }

    public toggleShowJitsi(): void {
        this.showJitsiWindow = !this.showJitsiWindow;
    }

    public toggleConferenceDialog(): void {
        if (this.isJitsiDialogOpen) {
            this.hideJitsiDialog();
        } else {
            this.showJitsiDialog();
        }
    }

    public hideJitsiDialog(): void {
        this.isJitsiDialogOpen = false;
    }

    public showJitsiDialog(): void {
        this.isJitsiDialogOpen = true;
        this.showJitsiWindow = false;
    }

    public viewStream(): void {
        this.stopJitsi();
        this.setConferenceState(ConferenceState.stream);
        this.showJitsiWindow = true;
    }

    public onSteamStarted(): void {
        this.streamRunning = true;
        this.storageMap.set(this.STREAM_RUNNING_STORAGE_KEY, true).subscribe(() => {});
    }

    private onLiveStreamAvailable(liveStreamUrl: string): void {
        this.videoStreamUrl = liveStreamUrl;
        // this is the "dead" state; you would see the jitsi state; but are not connected
        // or the connection is prohibited. If this occurs and a live stream
        // becomes available, switch to the stream state
        if (this.videoStreamUrl && this.currentState === ConferenceState.jitsi && !this.isJitsiActive) {
            this.viewStream();
        } else if (!this.videoStreamUrl && this.enableJitsi) {
            this.setConferenceState(ConferenceState.jitsi);
        }
    }

    private async deleteJitsiLock(): Promise<void> {
        await this.storageMap.delete(this.RTC_LOGGED_STORAGE_KEY).toPromise();
    }

    public async deleteStreamingLock(): Promise<void> {
        await this.storageMap.delete(this.STREAM_RUNNING_STORAGE_KEY).toPromise();
    }

    private setConferenceState(newState: ConferenceState): void {
        this.currentState = newState;
    }
}
