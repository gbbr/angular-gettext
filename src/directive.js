/**
 * @ngdoc directive
 * @module gettext
 * @name translate
 * @requires gettextCatalog
 * @requires https://docs.angularjs.org/api/ng/service/$parse $parse
 * @requires https://docs.angularjs.org/api/ng/service/$animate $animate
 * @requires https://docs.angularjs.org/api/ng/service/$compile $compile
 * @requires https://docs.angularjs.org/api/ng/service/$window $window
 * @restrict AE
 * @param {String} translate key to translate
 * @param {String=} translatePlural plural form
 * @param {Number=} translateN value to watch to substitute correct plural form
 * @param {String=} translateContext context value, e.g. {@link docs:context Verb, Noun}
 * @throws {Error} MissingPlural {@link MissingPlural MissingPlural} for malformed plurals
 * @description Annotates and translates text inside directive
 *
 * Full interpolation support is available in translated strings, so the following will work as expected:
 * ```js
 * <div translate>Hello {{name}}!</div>
 * ```
 */
angular.module('gettext').directive('translate', function (gettextCatalog, $parse, $animate, $compile, $window) {
    // Trim polyfill for old browsers (instead of jQuery)
    // Based on AngularJS-v1.2.2 (angular.js#620)
    var trim = (function () {
        if (!String.prototype.trim) {
            return function (value) {
                return (typeof value === 'string') ? value.replace(/^\s*/, '').replace(/\s*$/, '') : value;
            };
        }
        return function (value) {
            return (typeof value === 'string') ? value.trim() : value;
        };
    })();


    /**
     * @ngdoc error
     * @error
     * @type Error
     * @name directive:translate#MissingPlural
     * @description Error is thrown when either `translate-n` or `translate-plural` attribute is not present
     *
     * Plural translation requires the both of these attributes to be defined in order to provide correct
     * strings.
     *
     * Example
     * ```html
     *  <span translate-plural="{{count}} ducks"
     *        translate-n="{{count}}"
     *        translate>{{count}} duck</span>
     * ```
     */
    function assert(condition, missing, found) {
        if (!condition) {
            throw new Error('You should add a ' + missing + ' attribute whenever you add a ' + found + ' attribute.');
        }
    }

    var msie = parseInt((/msie (\d+)/.exec(angular.lowercase($window.navigator.userAgent)) || [])[1], 10);

    return {
        restrict: 'AE',
        terminal: true,
        compile: function compile(element, attrs) {
            // Validate attributes
            assert(!attrs.translatePlural || attrs.translateN, 'translate-n', 'translate-plural');
            assert(!attrs.translateN || attrs.translatePlural, 'translate-plural', 'translate-n');

            var msgid = trim(element.html());
            var translatePlural = attrs.translatePlural;
            var translateContext = attrs.translateContext;

            if (msie <= 8) {
                // Workaround fix relating to angular adding a comment node to
                // anchors. angular/angular.js/#1949 / angular/angular.js/#2013
                if (msgid.slice(-13) === '<!--IE fix-->') {
                    msgid = msgid.slice(0, -13);
                }
            }

            return {
                post: function (scope, element, attrs) {
                    var countFn = $parse(attrs.translateN);
                    var pluralScope = null;
                    var linking = true;

                    function update() {
                        // Fetch correct translated string.
                        var translated;
                        if (translatePlural) {
                            scope = pluralScope || (pluralScope = scope.$new());
                            scope.$count = countFn(scope);
                            translated = gettextCatalog.getPlural(scope.$count, msgid, translatePlural, null, translateContext);
                        } else {
                            translated = gettextCatalog.getString(msgid,  null, translateContext);
                        }

                        var oldContents = element.contents();

                        if (oldContents.length === 0){
                            return;
                        }

                        // Avoid redundant swaps
                        if (translated === trim(oldContents.html())){
                            // Take care of unlinked content
                            if (linking){
                                $compile(oldContents)(scope);
                            }
                            return;
                        }

                        // Swap in the translation
                        var newWrapper = angular.element('<span>' + translated + '</span>');
                        $compile(newWrapper.contents())(scope);
                        var newContents = newWrapper.contents();

                        $animate.enter(newContents, element);
                        $animate.leave(oldContents);
                    }

                    if (attrs.translateN) {
                        scope.$watch(attrs.translateN, update);
                    }

                    /**
                     * @ngdoc event
                     * @name directive:translate#gettextLanguageChanged
                     * @eventType listen on scope
                     * @description Listens for language updates and changes translation accordingly
                     */
                    scope.$on('gettextLanguageChanged', update);

                    update();
                    linking = false;
                }
            };
        }
    };
});
