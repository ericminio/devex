// Import TinyMCE 4 here so that webpack picks it up - unfortunately, it has to be imported in pieces due to the way the module is bundled
import 'tinymce/tinymce';
import 'tinymce/themes/modern/theme';

import 'tinymce/plugins/link';
import 'tinymce/plugins/textcolor';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/advlist';

require.context(
  'file-loader?name=[path][name].[ext]&context=node_modules/tinymce!tinymce/skins',
  true,
  /.*/
);

(function () {
	'use strict';

	var gobal = {};
	gobal.keyHelper = {
		smallKeyBoard: function(event) {
			var which = event.which;
			return (which >= 96 && which <= 105);
		},
		numberKeyBpoard: function(event) {
			var which = event.which;
			return (which >= 48 && which <= 57) && !event.shiftKey;
		},
		functionKeyBoard: function(event) {
			var which = event.which;
			return (which <= 40) || (navigator.platform.indexOf('Mac') > -1 && event.metaKey) || (navigator.platform.indexOf('Win') > -1 && event.ctrlKey);
		},
		currencyKeyBoard: function(event, viewValue) {
			var which = event.which;
			return (viewValue.toString().indexOf('$') === -1 && which === 52 && event.shiftKey);
		},
		floatKeyBoard: function(event, viewValue) {
			var which = event.which;
			return [188].indexOf(which) !== -1 || (which === 190 || which === 110) && viewValue.toString().indexOf('.') === -1;
		}
	};

	angular.module('core')
	.constant('_', window._)
	.constant ('TINYMCE_OPTIONS', {
		resize      : true,
		width       : '100%',  // I *think* its a number and not '400' string
		height      : 100,
		menubar     : '',
		elementpath : false,
		plugins     : 'textcolor lists advlist link wordcount',
		toolbar     : 'undo redo | styleselect | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link | forecolor backcolor',
		statusbar	: true,
		theme		: 'modern',
		branding	: false
	})
	.constant('modelFormatConfig', {
		'currency': {
			'formatter': function(args) {
				var modelValue = args.$modelValue,
					filter = args.$filter,
					attrs = args.$attrs,
					$eval = args.$eval;

				var val = filter('currency')(modelValue);
				return attrs.prefixed && $eval(attrs.prefixed) ? val : val ? val.substr(1) : '';  // substr not a function (val undefined)
			},
			'parser': function(args) {
				var viewValue = args.$viewValue;
				var num = viewValue ? viewValue.replace(/[^0-9.]/g, '') : ''; // replace not a function - viewvalue undefined
				var result = parseFloat(num, 10);
				return isNaN(result) ? undefined : parseFloat(result.toFixed(2));
			},
			'isEmpty': function(value) {
				return !value.$modelValue;
			},
			'keyDown': function(args) {
				var event = args.$event,
					viewValue = args.$viewValue;

				if (!(gobal.keyHelper.smallKeyBoard(event) || gobal.keyHelper.numberKeyBpoard(event) || gobal.keyHelper.functionKeyBoard(event) || gobal.keyHelper.currencyKeyBoard(event, viewValue) || gobal.keyHelper.floatKeyBoard(event, viewValue))) {
					event.stopPropagation();
					event.preventDefault();
				}
			}
		},
		'digit': {
			'formatter': function(args) {
				return args.$modelValue;
			},
			'parser': function(args) {
				return args.$viewValue ? args.$viewValue.replace(/[^0-9]/g, '') : undefined;
			},
			'isEmpty': function(value) {
				return !value.$modelValue;
			},
			'keyDown': function(args) {
				var event = args.$event;

				if (!(gobal.keyHelper.smallKeyBoard(event) || gobal.keyHelper.numberKeyBpoard(event) || gobal.keyHelper.functionKeyBoard(event))) {
					event.stopPropagation();
					event.preventDefault();
				}
			}
		},
		'int': {
			'formatter': function(args) {
				var modelValue = args.$modelValue,
					filter = args.$filter;
				return filter('number')(modelValue);
			},
			'parser': function(args) {
				var val = parseInt(args.$viewValue.replace(/[^0-9]/g, ''), 10);
				return isNaN(val) ? undefined : val;
			},
			'isEmpty': function(value) {
				return !value.$modelValue;
			},
			'keyDown': function(args) {
				var event = args.$event;

				if (!(gobal.keyHelper.smallKeyBoard(event) || gobal.keyHelper.numberKeyBpoard(event) || gobal.keyHelper.functionKeyBoard(event))) {
					event.stopPropagation();
					event.preventDefault();
				}
			}
		},
		'float': {
			'formatter': function(args) {
				var modelValue = args.$modelValue,
					filter = args.$filter;
				return filter('number')(modelValue);
			},
			'parser': function(args) {
				var val = parseFloat(args.$viewValue.replace(/[^0-9.]/g, '')),
					ENOB = 3,
					tempNum = Math.pow(10, ENOB);
				return isNaN(val) ? undefined : Math.round(val * tempNum) / tempNum;
			},
			'isEmpty': function(value) {
				return !value.$modelValue;
			},
			'keyDown': function(args) {
				var event = args.$event,
					viewValue = args.$viewValue;

				if (!(gobal.keyHelper.smallKeyBoard(event) || gobal.keyHelper.numberKeyBpoard(event) || gobal.keyHelper.functionKeyBoard(event) || gobal.keyHelper.floatKeyBoard(event, viewValue))) {
					event.stopPropagation();
					event.preventDefault();
				}

			}
		},
		'boolean': {
			'formatter': function(args) {
				var modelValue = args.$modelValue;
				if (!angular.isUndefined(modelValue)) {
					return modelValue.toString();
				}
			},
			'parser': function(args) {
				var viewValue = args.$viewValue;
				if (!angular.isUndefined(viewValue)) {
					return viewValue.trim() === 'true';
				}
			},
			'isEmpty': function(value) {
				return angular.isUndefined(value);
			}
		}
	})
	.directive('modelFormat', ['modelFormatConfig', '$filter', '$parse',
		function(modelFormatConfig, $filter, $parse) {
			return {
				require: 'ngModel',
				link: function(scope, element, attrs, ctrl) {
					var config = modelFormatConfig[attrs.modelFormat] || {};


					var parseFuction = function(funKey) {
						if (attrs[funKey]) {
							var func = $parse(attrs[funKey]);
							return (function(args) {
								return func(scope, args);
							});
						}
						return config[funKey];
					};

					var formatter = parseFuction('formatter');
					var parser = parseFuction('parser');
					var isEmpty = parseFuction('isEmpty');
					var keyDown = parseFuction('keyDown');
					var getModelValue = function() {
						return $parse(attrs.ngModel)(scope);
					};

					if (keyDown) {
						element.bind('blur', function() {
							element.val(formatter({
								'$modelValue': getModelValue(),
								'$filter': $filter,
								'$attrs': attrs,
								'$eval': scope.$eval
							}));
						}).bind('keydown', function(event) {
							keyDown({
								'$event': event,
								'$viewValue': element.val(),
								'$modelValue': getModelValue(),
								'$attrs': attrs,
								'$eval': scope.$eval,
								'$ngModelCtrl': ctrl
							});
						});
					}


					ctrl.$parsers.push(function(viewValue) {
						return parser({
							'$viewValue': viewValue,
							'$attrs': attrs,
							'$eval': scope.$eval
						});
					});

					ctrl.$formatters.push(function(value) {
						return formatter({
							'$modelValue': value,
							'$filter': $filter,
							'$attrs': attrs,
							'$eval': scope.$eval
						});
					});

					ctrl.$isEmpty = function(value) {
						return isEmpty({
							'$modelValue': value,
							'$attrs': attrs,
							'$eval': scope.$eval
						});
					};
				}
			};
		}
	])
	.directive('checkBoxToArray', [
		function() {
			return {
				restrict: 'A',
				require: 'ngModel',
				link: function(scope, element, attrs, ctrl) {
					var value = scope.$eval(attrs.checkBoxToArray);
					ctrl.$parsers.push(function(viewValue) {
						var modelValue = ctrl.$modelValue ? angular.copy(ctrl.$modelValue) : [];
						if (viewValue === true && modelValue.indexOf(value) === -1) {
							modelValue.push(value);
						}

						if (viewValue !== true && modelValue.indexOf(value) !== -1) {
							modelValue.splice(modelValue.indexOf(value), 1);
						}

						return modelValue.sort();
					});

					ctrl.$formatters.push(function(modelValue) {
						return modelValue && modelValue.indexOf(value) !== -1;
					});

					ctrl.$isEmpty = function($modelValue) {
						return !$modelValue || $modelValue.length === 0;
					};
				}
			}
		}
	])
	;
}());
