window.applicationCache.addEventListener('updateready', function() {
    console.log('update to newest');
    window.applicationCache.swapCache();
    location.reload();
});

window.applicationCache.addEventListener('error', function() {
    console.log('error when update cache');
});

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
	'underscore': {
	    exports: '_',
	},
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
	'jszip': {
	    exports: 'JSZip',
	},
	'jszip-load': {
	    deps: ['jszip'],
	    exports: 'JSZip',
	},
	'oauth': {
	    exports: 'OAuth',
	},
    }
});

require(['when', 'when/sequence', 'when/delay', 'when/pipeline',
	 'when/guard', 'when/monitor/console'],
	function(when, sequence, delay, pipeline, guard) {
	    window.when = when;
	    window.when.sequence = sequence;
	    window.when.delay = delay;
	    window.when.pipeline = pipeline;
	    window.when.guard = guard;
	    window.when.console = console;
	})

require(['jquery', 'stacktrace', 'handlebars',
	 'ember', 'sprintf', 'locache', 'd3', 'underscore',
	 'asana', 'logging', 'persistent', 'lock', 'index',
	 'app/statistics', 'app/woodpecker', 'jszip', 'jszip-load'],
	function ($, stacktrace, Handlebars, Ember, sprintf, locache, d3, _,
		  Asana, Logging, Persistent, Lock, Index, Statistics, Woodpecker, JSZip) {
	    window.$ = $;
	    window.stacktrace = stacktrace;
	    window.Handlebars = Handlebars;
	    window.Ember = Ember;
	    window.sprintf = sprintf;
	    window.locache = locache;
	    window.d3 = d3;
	    window._ = _;
	    window.Asana = Asana;
	    window.Logging = Logging;
	    window.Persistent = Persistent;
	    window.Lock = Lock;
	    window.Index = Index;
	    window.Statistics = Statistics;
	    window.Woodpecker = Woodpecker;
	    window.JSZip = JSZip;
	    if (!locache.get('oauth.io')) {
		var key = prompt('Please Fill OAuth.io Public Key:');
		if (key) {
		    locache.set('oauth.io', {
			public_key: key,
		    });
		} else {
		    alert('Key is empty.');
		}
	    }
	    $.ready(function() {
		setInterval(function() {
		    console.log('flush expire cache');
		    locache.cleanup();
		}, 86400000);
	    });
	});
