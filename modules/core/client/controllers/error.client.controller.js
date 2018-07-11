(function () {
	'use strict';

	var ErrorController = [
		'$stateParams', function($stateParams) {
			var vm = this;
			vm.errorMessage = null;

			// Display custom message if it was set
			if ($stateParams.message) vm.errorMessage = $stateParams.message;
		}
	]

	angular
	.module('core')
	.controller('ErrorController', ErrorController);
}());

