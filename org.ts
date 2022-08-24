import {
    Component,
    Input,
    OnInit
} from '@angular/core';
import {
    ActivatedRoute,
    Params
} from '@angular/router';
import { Subscription } from 'rxjs';
import { SecondaryHeaderService } from './../../../../../layout/header/repository-header/secondary-header/secondary-header.service';
import { RepositoryDashboardService } from '../repository-dashboard.service';
import { RepositoryDashboardOverview } from './dashboard-overview';

@Component({
    selector: 'app-dashboard-overview',
    templateUrl: './dashboard-overview.component.html',
    styleUrls: ['./dashboard-overview.component.scss']
})
export class DashboardOverviewComponent implements OnInit {
    @Input() overviewDetails: RepositoryDashboardOverview;
    loadRepoDashBoardOverview: boolean;
    constructor(private route: ActivatedRoute, private repositoryDashboardService: RepositoryDashboardService,
        private secondaryHeaderService: SecondaryHeaderService) {
        this.loadRepoDashBoardOverview = false;
    }
    repositoryUid: string;
    snapshotSubscription: Subscription;
    paramsSubscription: Subscription;
    queryParamsSubscription: Subscription;
    ngOnInit(): void {
        this.snapshotSubscription = this.secondaryHeaderService.getSnapshotId().subscribe(
            (snapshotId: number) => {
                this.repositoryDashboardService.snapshotId = snapshotId;
                this.repositoryDashboardService.getRepositoryOverview();
            });
        this.paramsSubscription = this.route.parent.params.subscribe(
            (params: Params) => {
                this.repositoryUid = (params['repositoryUid']).toString();
                // call to service will go here
                this.queryParamsSubscription = this.route.queryParams.subscribe(repoParams => {
                    this.repositoryDashboardService.setParameters(this.repositoryUid, repoParams.snapshotId);
                    this.getRepositoryOverview();
                });
            }
        );
    }

    getRepositoryOverview(): void {
        this.repositoryDashboardService.getRepositoryOverview();
        this.repositoryDashboardService.getRepositoryOverviewData().subscribe(result => {
            if (result !== null) {
                this.loadRepoDashBoardOverview = true;
                this.overviewDetails = result;
            }
        });
    }

    // on component destroy
    ngOnDestroy() {
        this.paramsSubscription.unsubscribe();
        this.queryParamsSubscription.unsubscribe();
        this.snapshotSubscription.unsubscribe();
    }

}
