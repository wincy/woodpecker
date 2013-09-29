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
    }
});

require(['when', 'when/sequence', 'when/delay', 'when/guard'],
	function(when, sequence, delay, guard) {
	    window.when = when;
	    window.when.sequence = sequence;
	    window.when.delay = delay;
	    window.when.guard = guard;
	})

require(['jquery', 'stacktrace', 'handlebars',
	 'ember', 'sprintf', 'locache', 'd3',
	 'app/asana', 'app/logging', 'app/persistent', 'app/lock', 'app/index',
	 'app/statistics', 'app/woodpecker'],
	function ($, stacktrace, Handlebars, Ember, sprintf, locache, d3,
		  Asana, Logging, Persistent, Lock, Index, Statistics, Woodpecker) {
	    window.$ = $;
	    window.stacktrace = stacktrace;
	    window.Handlebars = Handlebars;
	    window.Ember = Ember;
	    window.sprintf = sprintf;
	    window.locache = locache;
	    window.d3 = d3;
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
