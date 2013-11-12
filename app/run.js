(function(curl) {

	var cjsConfig = { moduleLoader: 'curl/loader/cjsm11' };

	curl({
		main: 'wire!app/main',
		packages: {
			curl: { location: 'lib/curl/src/curl' },
			wire: { location: 'lib/wire', main: 'wire', config: cjsConfig },
			cola: { location: 'lib/cola', main: 'cola' },
			most: { location: 'lib/most', main: 'most', config: cjsConfig },
			rest: { location: 'lib/rest', main: 'rest' },
			when: { location: 'lib/when', main: 'when' },
			meld: { location: 'lib/meld', main: 'meld' },
			poly: { location: 'lib/poly' }
		},
		preloads: ['poly/all']
	});

})(curl);