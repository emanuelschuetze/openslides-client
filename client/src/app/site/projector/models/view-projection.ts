import { BaseModel } from 'app/shared/models/base/base-model';
import { Projection } from 'app/shared/models/projector/projection';
import { HasProjectorTitle, ProjectorTitle } from 'app/site/base/projectable';
import { ProjectionBuildDescriptor } from 'app/site/base/projection-build-descriptor';
import { HasMeeting } from 'app/site/event-management/models/view-meeting';
import { BaseViewModel } from '../../base/base-view-model';
import { ViewProjector } from './view-projector';

export class ViewProjection extends BaseViewModel<Projection> {
    public static COLLECTION = Projection.COLLECTION;
    protected _collection = Projection.COLLECTION;

    public get projection(): Projection {
        return this._model;
    }

    public isEqualToDescriptor(descriptor: ProjectionBuildDescriptor): boolean {
        return (
            this.content_object_id === descriptor.content_object_id &&
            !!this.stable === !!descriptor.stable &&
            ((!this.type && !descriptor.type) || this.type === descriptor.type)
        );
    }

    private getProjectorTitle(): ProjectorTitle {
        return this.content_object.getProjectorTitle(this.getModel());
    }

    public getTitle = () => {
        return this.getProjectorTitle().title;
    };

    public getSubtitle(): string {
        return this.getProjectorTitle().subtitle || '';
    }
}
interface IProjectionRelations {
    current_projector?: ViewProjector;
    preview_projector?: ViewProjector;
    history_projector?: ViewProjector;
    content_object: BaseViewModel & HasProjectorTitle;
}
export interface ViewProjection extends Projection, IProjectionRelations, HasMeeting {}
