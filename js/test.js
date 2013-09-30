require.config({
    baseUrl: '/woodpecker/js/lib',
    paths: {
	jquery: 'jquery-2.0.0',
	app: '../app',
    },
    packages: [
	{name: 'when', location: 'when', main: 'when'},
    ],
    preloads: ['when/monitor/console'],
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
    }
});

require(['when', 'when/sequence', 'when/delay', 'when/guard',
	 'when/pipeline', 'when/parallel'],
	function(when, sequence, delay, guard, pipeline, parallel) {
	    window.when = when;
	    window.when.sequence = sequence;
	    window.when.delay = delay;
	    window.when.guard = guard;
	    window.when.pipeline = pipeline;
	    window.when.parallel = parallel;
	});

require(['jquery', 'stacktrace', 'handlebars',
	 'ember', 'sprintf', 'locache', 'd3', 'qunit',
	 'app/logging', 'app/persistent', 'app/lock', 'app/index', 'app/asana',
	 'app/statistics', 'app/woodpecker'],
	function ($, stacktrace, Handlebars, Ember, sprintf, locache, d3, QUnit,
		  Logging, Persistent, Lock, Index, Asana, Statistics, Woodpecker) {
	    window.$ = $;
	    window.stacktrace = stacktrace;
	    window.Handlebars = Handlebars;
	    window.Ember = Ember;
	    window.sprintf = sprintf;
	    window.locache = locache;
	    window.d3 = d3;
	    window.QUnit = QUnit;
	    window.Asana = Asana;
	    window.asana = new Asana('http://warm-wave-2086.herokuapp.com/asana');
	    window.Logging = Logging;
	    window.Persistent = Persistent;
	    window.Lock = Lock;
	    window.Index = Index;
	    window.Statistics = Statistics;
	    window.Woodpecker = Woodpecker;
	    $.ready(function() {
		window.applicationCache.addEventListener('updateready', function() {
		    console.log('update to newest');
		    window.applicationCache.swapCache();
		    location.reload();
		});

		window.applicationCache.addEventListener('error', function() {
		    console.log('error when update cache');
		});

		setInterval(function() {
		    console.log('flush expire cache');
		    locache.cleanup();
		}, 86400000);
	    });
	});

require(
  ["qunit", "app/lock", "app/asana"],
  function(QUnit, Lock) {
      var asana = new Asana('http://warm-wave-2086.herokuapp.com/asana');
      Asana.test(asana);
      Lock.test();
      QUnit.load();
      QUnit.start();
  }
);

console.log('loaded');