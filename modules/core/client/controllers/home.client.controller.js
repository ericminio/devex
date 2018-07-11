(function () {
  'use strict';

  var HomeController = [
    'Authentication',
    '$state',
    function (Authentication, $state) {
      var vm = this;
      vm.isUser = Authentication.user;
      if (sessionStorage.prevState) {
		var prevState = sessionStorage.prevState;
		var prevParams = JSON.parse(sessionStorage.prevParams);
		delete sessionStorage.prevState;
		delete sessionStorage.prevParams;
        $state.go(prevState, prevParams);
      }
    }
  ];

  angular
    .module('core')
    .controller('HomeController', HomeController);
}());
