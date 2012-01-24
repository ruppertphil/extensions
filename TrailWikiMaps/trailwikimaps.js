/**
 * JavaScript for TrailWikiMaps MediaWiki extension
 * - creates a map with markers positions retrieved via AJAX and custom info overlays with content retrieved via AJAX
 */

function InfoBox( marker ) {
	google.maps.OverlayView.call( this );
	this.latlng_ = marker.position;
	this.map_ = marker.map;
	this.opt_ = marker.opt;
	this.titles_ = marker.titles;
	var me = this;
	this.boundsChangedListener_ = google.maps.event.addListener( this.map_, "bounds_changed", function() {
		return me.panMap.apply( me );
	});
	this.setMap( this.map_ );
	if( this.opt.currentInfobox ) this.opt.currentInfobox.setMap( null );
	this.opt.currentInfobox = this;
}

InfoBox.prototype = new google.maps.OverlayView();

InfoBox.prototype.remove = function() {
	if( this.div_ ) {
		this.div_.parentNode.removeChild( this.div_ );
		this.div_ = null;
	}
};

InfoBox.prototype.draw = function() {
	this.createElement();
	if( !this.div_ ) return;
	var pixPosition = this.getProjection().fromLatLngToDivPixel( this.latlng_ );
	if( !pixPosition ) return;
	this.width_ = $( this.div_ ).width();
	this.height_ = $( this.div_ ).height();
	this.offsetVertical_ = -this.height_;
	this.offsetHorizontal_ = 0;
	this.div_.style.left = ( pixPosition.x + this.offsetHorizontal_ ) + "px";
	this.div_.style.top = ( pixPosition.y + this.offsetVertical_ ) + "px";
	this.div_.style.display = 'block';
};

InfoBox.prototype.createElement = function() {
	var panes = this.getPanes();
	var div = this.div_;
	if(!div) {
		div = this.div_ = document.createElement('div');
		div.className = 'ajaxmap-info';
		var contentDiv = document.createElement('div');
		contentDiv.className = 'ajaxmap-info-content';
		this.loadContent(this.titles_, contentDiv, this.opt_);
		var topDiv = document.createElement('div');
		topDiv.className = 'ajaxmap-info-top';
		titlep = document.createElement('div');
		title = document.createElement('a');
		title.innerHTML = this.titles_[0];
		title.href = mw.util.wikiScript() + '?' + $.param({ title: this.titles_[0] });
		var closeImg = document.createElement('img');
		closeImg.src = '/w/images/5/50/Icon_delete_25.png';
		topDiv.appendChild(closeImg);
		topDiv.appendChild(titlep);
		titlep.appendChild(title);

		function removeInfoBox(ib) {
			return function() {
				ib.setMap(null);
			};
		}

		google.maps.event.addDomListener(closeImg, 'click', removeInfoBox(this));

		div.appendChild(topDiv);
		div.appendChild(contentDiv);
		div.style.display = 'none';
		panes.floatPane.appendChild(div);
		this.panMap();
	} else if(div.parentNode != panes.floatPane) {
		div.parentNode.removeChild(div);
		panes.floatPane.appendChild(div);
	}
}

InfoBox.prototype.panMap = function() {
	var map = this.map_;
	var bounds = map.getBounds();
	if(!bounds) return;

	// The position of the infowindow
	var position = this.latlng_;
	var iwWidth = this.width_;
	var iwHeight = this.height_;
	var iwOffsetX = this.offsetHorizontal_;
	var iwOffsetY = this.offsetVertical_;

	// Padding on the infowindow
	var padX = 0; //40;
	var padY = 0; //40;

	// The degrees per pixel
	var mapDiv = map.getDiv();
	var mapWidth = mapDiv.offsetWidth;
	var mapHeight = mapDiv.offsetHeight;
	var boundsSpan = bounds.toSpan();
	var longSpan = boundsSpan.lng();
	var latSpan = boundsSpan.lat();
	var degPixelX = longSpan / mapWidth;
	var degPixelY = latSpan / mapHeight;

	// The bounds of the map
	var mapWestLng = bounds.getSouthWest().lng();
	var mapEastLng = bounds.getNorthEast().lng();
	var mapNorthLat = bounds.getNorthEast().lat();
	var mapSouthLat = bounds.getSouthWest().lat();

	// The bounds of the infowindow
	var iwWestLng = position.lng() + (iwOffsetX - padX) * degPixelX;
	var iwEastLng = position.lng() + (iwOffsetX + iwWidth + padX) * degPixelX;
	var iwNorthLat = position.lat() - (iwOffsetY - padY) * degPixelY;
	var iwSouthLat = position.lat() - (iwOffsetY + iwHeight + padY) * degPixelY;

	// calculate center shift
	var shiftLng =
	  (iwWestLng < mapWestLng ? mapWestLng - iwWestLng : 0) +
	  (iwEastLng > mapEastLng ? mapEastLng - iwEastLng : 0);
	var shiftLat =
	  (iwNorthLat > mapNorthLat ? mapNorthLat - iwNorthLat : 0) +
	  (iwSouthLat < mapSouthLat ? mapSouthLat - iwSouthLat : 0);

	// The center of the map
	var center = map.getCenter();

	// The new map center
	var centerX = center.lng() - shiftLng;
	var centerY = center.lat() - shiftLat;

	// center the map to the new shifted center
	map.setCenter(new google.maps.LatLng(centerY, centerX));

	// Remove the listener after panning is complete.
	google.maps.event.removeListener(this.boundsChangedListener_);
	this.boundsChangedListener_ = null;
};


/**
 * Load content for passed titles and add to target element
 */
InfoBox.prototype.loadContent = function( titles, div, opt ) {
	for( i in titles ) {

		// Add heading/link for trails except first which has its heading in infobox title bar
		if( i > 0 ) {
			var hr = document.createElement('hr');
			div.appendChild(hr);
			var heading = document.createElement('a');
			heading.innerHTML = titles[i];
			heading.href = mw.util.wikiScript() + '?' + $.param({ title: titles[i] });
			div.appendChild(heading);
		}

		// First check if it exits in the loaded opt info
		if( titles[i] in opt.trailinfo ) this.renderTrailInfo( titles[i], opt.trailinfo[titles[i]], div );
		else {

			// Create a div element for the info with a loading animation in it
			var target = document.createElement('div');
			div.appendChild(target);
			var loader = document.createElement('img');
			loader.src = '/w/skins/common/images/ajax-loader.gif';
			loader.className = 'ajaxmap-info-loader';
			target.appendChild(loader);

			// Request the content for the target div
			$.ajax({
				type: 'GET',
				url: mw.util.wikiScript(),
				data: { title: titles[i], action: 'trailinfo' },
				dataType: 'html',
				success: function( html ) { this.innerHTML = html; },
				context: target
			});
		}
	}
};


/**
 * Render passed trail info into the passed element
 */
InfoBox.prototype.renderTrailInfo = function( title, info, div ) {
	var unknown = '<i>unknown</i>';
	var d = 'd' in info ? info.d : unknown;
	var e = 'e' in info ? info.e : unknown;
	var h = 'h' in info ? info.h : unknown;
	var s = 's' in info ? info.s : unknown;
	var r = 'r' in info ? info.r : unknown;

	var uses = '';
	for( i in info.u ) {
		uses = uses + '<img class="ajaxmap-info-icon" alt="' + i + '" src="/w/images/' + info.u[i] + '" />';
	}

	var img = 'i' in info ? info.i : '/5/56/Placeholder.gif/140px-Placeholder.gif';
	var img = '<img class="ajaxmap-info-image" alt="' + title + '" src="/w/images/thumb/' + img + '" />';

	html = '<b>Distance: </b>' + d + '<br />';
	html = html + '<b>Elevation Gain: </b>' + e + '<br />';
	html = html + '<b>High Point: </b>' + h + '<br />';
	html = html + '<b>Trail Uses: </b>' + uses + '<br />';
	html = html + '<b>Difficulty: </b>' + s + '<br />';
	html = html + '<b>Rating: </b>' + r + '<br />';

	div.innerHTML = '<table><tr><td>' + html + '</td><td>' + img + '</td></tr></table>';
}

/**
 * Create a transformed location table from the passed filter data and update the markers to match it
 */
function transformMarkers( opt, filter ) {

	// Create new location table from the original data and the filter


	// Update markers that have changed
	for( i in data ) {
		var pos = i.split(',');
		var marker = new google.maps.Marker({
			position: new google.maps.LatLng(pos[0], pos[1]),
			icon: this.icon,
			map: this.map,
			opt: this,
			titles: data[i]
		});
		google.maps.event.addListener( marker, 'click', function() { new InfoBox(this); });
	}

	// Make the new location table current
}


/**
 * Loop through the map options array creating each map
 */
if( 'ajaxmap_opt' in window ) {
	for( map in window.ajaxmap_opt ) {
		var opt = window.ajaxmap_opt[map];

		// Create the map and set canvas size
		var canvas = document.getElementById(map);
		canvas.style.width = opt.width;
		canvas.style.height = opt.height;

		// Initialise some of the options
		opt.map = new google.maps.Map(canvas, opt);
		opt.center = new google.maps.LatLng( opt.lat, opt.lon );
		opt.mapTypeId = google.maps.MapTypeId[opt.type.toUpperCase()];
		opt.trailinfo = {};
		opt.currentInfobox = 0;
		opt.icon = new google.maps.MarkerImage('/w/images/b/b9/Icon_Map_Square.png'); // hard-coded icon for now

		// Retrieve location info from server
		var data = { action: 'traillocations' };
		if( 'query' in opt ) data.query = opt.query;
		$.ajax({
			type: 'POST',
			url: mw.util.wikiScript(),
			data: data,
			dataType: 'json',
			context: opt,
			success: function( data ) {
				this.locations = data;
				transformMarkers( this, {} ); // update markers with no filter
			}
		});

		// Retrieve the detailed information for each trail
		data.action = 'trailinfo';
		$.ajax({
			type: 'POST',
			url: mw.util.wikiScript(),
			data: data,
			dataType: 'json',
			context: opt,
			success: function( data ) { this.trailinfo = data; }
		});

	}
}
