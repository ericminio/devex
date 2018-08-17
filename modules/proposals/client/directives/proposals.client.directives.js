(function () {
	'use strict';
	angular.module ('proposals')
	.directive('selectOnClick', ['$window', function ($window) {
		return {
			restrict: 'A',
			link: function (scope, element, attrs) {
				element.on('click', function () {
					if (!$window.getSelection().toString()) {
						// Required for mobile Safari
						this.setSelectionRange(0, this.value.length)
					}
				});
			}
		};
	}])
	// -------------------------------------------------------------------------
	//
	// directive for the button to apply, edit, or review proposal
	//
	// -------------------------------------------------------------------------
	.directive ('proposalApply', function () {
		return {
			replace: true,
			restrict     : 'E',
			controllerAs : 'qaz',
			templateUrl  : '/modules/proposals/client/views/proposal-apply.directive2.html',
			scope        : {
				opportunity: '=',
				proposal: '='
			},
			controller   : ['$scope', 'Authentication', function ($scope, Authentication) {
				var qaz = this;
				qaz.opportunity = $scope.opportunity;
				qaz.proposal = $scope.proposal;
				//
				// we need to determine which of several possibilities we have
				//
				// - not logged in <please log in>
				// - logged in as gov user (not opportunity admin) <nothing>
				// - logged in as apportunity admin (or admin) <nothing>
				// - logged in as user NOT gov
				//   - proposal Id : edit
				//   - no proposal id: create
				//
				var isUser            = Authentication.user;
				var isAdmin           = isUser && !!~Authentication.user.roles.indexOf ('admin');
				var isGov             = isUser && !!~Authentication.user.roles.indexOf ('gov');
				var isMemberOrWaiting = isUser && (qaz.opportunity.userIs.member || qaz.opportunity.userIs.request);
				var isProposal        = qaz.proposal && qaz.proposal._id;
				var canedit           = !(isAdmin || isGov || isMemberOrWaiting);
				qaz.isSprintWithUs    = qaz.opportunity.opportunityTypeCd === 'sprint-with-us';
				var hasCompany        = isUser && Authentication.user.orgsAdmin.length > 0;
				hasCompany            = qaz.opportunity.hasOrg;
				qaz.case              = 'nothing';
				if (!isUser) qaz.case = 'guest';
				//
				// if the user is even allowed to add proposals
				//
				else if (canedit) {
					//
					// they have one, let them erdit it
					//
					if (isProposal) qaz.case = 'canedit';
					//
					// dont have one, code with us, let them add one
					//
					else if (!qaz.isSprintWithUs) qaz.case = 'canadd';
					//
					// dont have one, sprint with us, have company, let them add
					//
					else if (hasCompany) qaz.case = 'canadd';
					//
					// dont have one, sprint with us, no company, tell then they need one
					//
					else qaz.case = 'needscompany';
				}
			}]
		};
	})
	// -------------------------------------------------------------------------
	//
	// directive for listing proposals
	//
	// -------------------------------------------------------------------------
	.directive ('proposalList', function () {
		return {
			restrict     : 'E',
			controllerAs : 'vm',
			scope        : {
				opportunity: '=',
				isclosed: '=',
				title: '@',
				context: '@'
			},
			templateUrl  : '/modules/proposals/client/views/list.proposals.directive.html',
			controller   : function ($scope, ProposalsService, Authentication, Notification) {
				var vm     = this;
				vm.opportunity = $scope.opportunity;
				vm.context = $scope.context;
				vm.proposals = [];
				vm.stats = {};
				vm.isclosed = $scope.isclosed;
				var isUser = Authentication.user;
				vm.isAdmin = isUser && !!~Authentication.user.roles.indexOf ('admin');
				vm.isGov   = isUser && !!~Authentication.user.roles.indexOf ('gov');
				if (vm.context === 'opportunity') {
					vm.opportunityId = vm.opportunity._id;
					vm.programTitle = vm.opportunity.title;
				} else {
					vm.opportunityId = null;
					vm.programTitle = null;
				}
				//
				// if a opportunity is supplied, then only list proposals under it
				// also allow adding a new proposal (because it has context)
				//
				if ($scope.opportunity) {
					vm.title      = 'Proposals for '+$scope.opportunity.title;
					vm.opportunityId  = $scope.opportunity._id;
					vm.userCanAdd = $scope.opportunity.userIs.admin || vm.isAdmin;
					vm.proposals   = ProposalsService.forOpportunity ({
						opportunityId: $scope.opportunity._id
					});
					vm.columnCount = 1;
				} else {
					vm.title      = 'All Proposals';
					vm.opportunityId  = null;
					vm.userCanAdd = (vm.isAdmin || vm.isGov);
					vm.proposals   = ProposalsService.query ();
					vm.columnCount = 1;
				}
				if ($scope.opportunity)
				{
					vm.stats = ProposalsService.getStats ({
						opportunityId: $scope.opportunity._id
					});
				}
				if ($scope.title) vm.title = $scope.title;
				vm.publish = function (proposal, state) {
					var publishedState = proposal.isPublished;
					var t = state ? 'Published' : 'Un-Published'
					proposal.isPublished = state;
					proposal.createOrUpdate ()
					//
					// success, notify and return to list
					//
					.then (function () {
						Notification.success ({
							message : '<i class="glyphicon glyphicon-ok"></i> Proposal '+t+' Successfully!'
						});
					})
					//
					// fail, notify and stay put
					//
					.catch (function (res) {
						proposal.isPublished = publishedState;
						Notification.error ({
							message : res.data.message,
							title   : '<i class=\'glyphicon glyphicon-remove\'></i> Proposal '+t+' Error!'
						});
					});
				};
				vm.request = function (proposal) {
					ProposalsService.makeRequest ({
						proposalId: proposal._id
					}).$promise
					.then (function () {
						proposal.userIs.request = true;
						Notification.success({ message: '<i class="glyphicon glyphicon-ok"></i> Membership request sent successfully!' });
					})
					.catch (function (res) {
						Notification.error ({
							message : res.data.message,
							title   : '<i class=\'glyphicon glyphicon-remove\'></i> Membership Request Error!'
						});
					});
				};
			}
		}
	})
	// -------------------------------------------------------------------------
	//
	// directive for listing company proposals
	//
	// -------------------------------------------------------------------------
	.directive ('companyProposals', function () {
		return {
			restrict     : 'E',
			controllerAs : 'vm',
			scope        : {
				org: '=',
				title: '@',
				context: '@'
			},
			templateUrl  : '/modules/proposals/client/views/company-proposals-directive.html',
			controller   : function ($scope, TeamsService, Authentication, Notification) {
				var vm     = this;
				vm.program = $scope.program;
				vm.context = $scope.context;
				var isUser = Authentication.user;
				vm.isAdmin = isUser && !!~Authentication.user.roles.indexOf ('admin');
				vm.isGov   = isUser && !!~Authentication.user.roles.indexOf ('gov');
				vm.userCanAdd = vm.isAdmin;
				if ($scope.title) vm.title = $scope.title;
			}
		}
	})
	;
}());
