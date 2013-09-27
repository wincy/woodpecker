window.applicationCache.addEventListener('updateready', function() {
    console.log('update to newest');
    window.applicationCache.swapCache();
});

Woodpecker = Ember.Application.create({
    ready: function () {
	Woodpecker.selector = Ember.ObjectController.create();
	Woodpecker.selector.view = Ember.CollectionView.create({
	    content: [1,2,3].map(function(i) {
	    	return Ember.Object.create({name: i});
	    }),
	    itemViewClass: Woodpecker.SelectorOptionView,
	});
	
    }
})

Woodpecker.SelectorOptionView = Ember.View.extend({
    templateName: 'selector-option',
})
