require.config({
    baseUrl: '/woodpecker/js/lib',
    paths: {
	jquery: 'jquery-2.0.0',
	app: '../app',
    },
    packages: [
	{name: 'when', location: 'when', main: 'when'},
	{name: 'asana', location: 'asana', main: 'asana'},
    ],
    shim: {
	'locache': {
	    exports: 'locache',
	},
	'sprintf': {
	    exports: 'sprintf',
	},
        'handlebars': {
            exports: 'Handlebars',
        },
	'ember': {
	    deps: ['handlebars'],
	    exports: 'Ember',
	},
	'd3': {
	    exports: 'd3',
	},
	'qunit': {
	    exports: 'QUnit',
	    init: function() {
		QUnit.config.autoload = false;
		QUnit.config.autostart = false;
            },
	},
	'oauth': {
	    exports: 'OAuth',
	},
    }
});

require(['when', 'when/sequence', 'when/delay', 'when/guard',
	 'when/pipeline', 'when/parallel', 'when/monitor/console'],
	function(when, sequence, delay, guard, pipeline, parallel, console) {
	    window.when = when;
	    window.when.sequence = sequence;
	    window.when.delay = delay;
	    window.when.guard = guard;
	    window.when.pipeline = pipeline;
	    window.when.parallel = parallel;
	    window.when.console = console;
	});

// require(['jquery', 'stacktrace', 'handlebars',
// 	 'ember', 'sprintf', 'locache', 'd3', 'qunit',
// 	 'logging', 'persistent', 'lock', 'index', 'asana',
// 	 'app/statistics', 'app/woodpecker'],
// 	function ($, stacktrace, Handlebars, Ember, sprintf, locache, d3, QUnit,
// 		  Logging, Persistent, Lock, Index, Asana, Statistics, Woodpecker) {
// 	    window.$ = $;
// 	    window.stacktrace = stacktrace;
// 	    window.Handlebars = Handlebars;
// 	    window.Ember = Ember;
// 	    window.sprintf = sprintf;
// 	    window.locache = locache;
// 	    window.d3 = d3;
// 	    window.QUnit = QUnit;
// 	    window.Asana = Asana;
// 	    window.asana = new Asana('http://warm-wave-2086.herokuapp.com/asana');
// 	    window.Logging = Logging;
// 	    window.Persistent = Persistent;
// 	    window.Lock = Lock;
// 	    window.Index = Index;
// 	    window.Statistics = Statistics;
// 	    window.Woodpecker = Woodpecker;
// 	    $.ready(function() {
// 		window.applicationCache.addEventListener('updateready', function() {
// 		    console.log('update to newest');
// 		    window.applicationCache.swapCache();
// 		    location.reload();
// 		});

// 		window.applicationCache.addEventListener('error', function() {
// 		    console.log('error when update cache');
// 		});

// 		setInterval(function() {
// 		    console.log('flush expire cache');
// 		    locache.cleanup();
// 		}, 86400000);
// 	    });
// 	})
;

require(
  ["qunit", "lock", "asana", "asana/model", "asana/remote", "persistent", "oauth"],
  function(QUnit, Lock, Asana, Model, Remote, Persistent, OAuth) {
      window.Asana = Asana;
      window.OAuth = OAuth;
      // Asana.test(asana);
      // Lock.test();
      // window.Asana.User = User;
      // window.Asana.Workspace = Workspace;
      // Remote.test();
      // Model.test();
      Asana.test();
      QUnit.load();
      QUnit.start();
  }
);

console.log('loaded');
