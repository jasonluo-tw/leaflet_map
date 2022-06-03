//detect keyboard event
var basemap_key_flag = false
document.addEventListener('keydown', (evt)=>{
  if(evt.shiftKey){
    basemap_key_flag = true
  }
})
document.addEventListener('keyup', (evt)=>{
  if(evt.keyCode === 16){
    basemap_key_flag = false
  }
})

// Define TopoJSON
L.TopoJSON = L.GeoJSON.extend({
    addData: function (data) {
        var geojson, key;
        if (data.type === "Topology") {
            for (key in data.objects) {
                if (data.objects.hasOwnProperty(key)) {
                    geojson = topojson.feature(data, data.objects[key]);
                    L.GeoJSON.prototype.addData.call(this, geojson);
                }
            }
            return this;
        }
        L.GeoJSON.prototype.addData.call(this, data);
        return this;
    }
})

L.topoJson = function (data, options) {
    return new L.TopoJSON(data, options);
}

/*
 *   pts_group.clearLayers() --> Done
 *   Regional selection --> Done
 *   changeConfig
 *   Contourf --> Done
 *   WindFlow --> Done
 *   Point colorbar --> Done
 *
 */
class BaseMap {
    constructor (DOM_ID, clat=36, clon=139.5) {
        this.outDOM = DOM_ID
	this.inDOM  = "inside_map"
	this.colorbarDOM = "colorbox"
        this.clat = clat
	this.clon = clon
	this.clicking_pts = []
        this.bb = new Object()
	// default map config
	this.mapConfig = {
            center: [clat, clon],
            zoom: 7,
	    maxZoom: 17,
	    minZoom: 2,
	    zoomControl: true,
	    //fadeAnimation: false,
	    attributionControl: false,
	    boxZoom: false,
	}
	// add new div(inside_map) block to outDOM
	let parent_div = document.getElementById(DOM_ID)
	let child_div  = document.createElement("div") 
	child_div.setAttribute("id", this.inDOM)
        parent_div.appendChild(child_div)	
    }

    //TODO: add "modify config function"
    changeConfig () {
    }

    addBaseMap (point_click=false) {
        this.basemap = L.map(this.inDOM, this.mapConfig)
        let pt_pane = this.basemap.createPane('ptsPane')
        pt_pane.style.zIndex = 1000
	this.pts_group = L.featureGroup({pane: pt_pane}).addTo(this.basemap)
        this._multiple_select_init()
	// add control layer
	this.layer_control = L.control.layers()
	this.layer_control.addTo(this.basemap)
	this.layer_control.addOverlay(this.pts_group, 'points')

	let this_ = this
	// enable point clicking
	if(point_click) {
	    this.pts_group.on("click", function(e){
	        this_._pt_click(e.layer, basemap_key_flag)
	    })
        }
	return this
    }

    addMapboxMap(map_id='mapbox/light-v10') {
        //attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors,   Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        let this_ = this
	let path = 'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}'
	let access_token = 'pk.eyJ1IjoiamFzb25sdW8iLCJhIjoiY2wycnAycnFyMDV2NTNkbnJiZ2s2cDZ2eCJ9.GrhXfnCmF3Mgsna8-8tBOA'
        let tile = L.tileLayer(path, {
		maxZoom: 18,
		//id: 'mapbox/streets-v11',
		id: map_id,
		tileSize: 512,
		zoomOffset: -1,
		accessToken: access_token
	})
	tile.addTo(this_.basemap)
        return this	
    }

    addJP () {
	let this_ = this
        fetch('https://smtgvs.weathernews.jp/s/topics/map/japan.topojson')
        .then(function(response){
          return response.json()
        })
        .then(function(_map){
            this_.bb['one_color'] = create_japan_tile_map(_map, { "strokeStyle": "#a0a0a0", "fillStyle": "#eeeeee", "pane":"basemap" })
	    this_.bb['one_color'].addTo(this_.basemap)
	    this_.layer_control.addBaseLayer(this_.bb['one_color'], 'JP map')
        })
	return this
    }

    addWindFlow(data) {
        this.velocity_layer = L.velocityLayer({
            displayValues: true,
            displayOptions: {
                velocityType: "GSM Wind",
                position: "bottomleft",
                emptyString: "No wind data",
            },
            data: data,
	    velocityScale: 0.03,
            opacity: 1,
	    minVelocity: 0,
            maxVelocity: 35
        })
        this.basemap.getPane("overlayPane").style.zIndex = 2000
        this.layer_control.addOverlay(this.velocity_layer, "wind")
	//console.log('Success to load wind')
    }

    addClickFunction (self_fun) {
        this.click_function = self_fun
    }
    //TODO: unclick
    addUnClick (self_fun) {
	this.unclick_function = self_fun
    }

    addPoints (datas, config) {
        /*
          necessary 
          datas: [{lat, lon, name, err}, {}]
	  config: {showValue: 'err', colorbar: {bar: colorbar, minv: minv, maxv: maxv}, label: string}
          demo:
             label = `${name}<br>${vm.ntype} err:${error}`
        */
        let elename, colorbar, minv, maxv
        if('showValue' in config){
            elename = config['showValue']
            if('colorbar' in config){
                colorbar = config['colorbar']['bar']
		minv = config['colorbar']['minv']
		maxv = config['colorbar']['maxv']
	    }else{
	        // default colorbar
                [colorbar, minv, maxv] = getColorbar(datas, elename)
	    }
	    this._add_color_bar(minv, maxv, colorbar)
	}
	
        for(let i in datas){
	    let name = datas[i]['name']
            let d_color
	    if(elename){
	        var value = datas[i][elename]
	    }else{
                var value = null
	    }
            if(value){
	        d_color = colorbar(value)
	    }else if(datas[i]['color']){
		d_color = datas[i]['color']
	    }else{
                d_color = '#18307D'
	    }
	    // change floating format
	    if(value != null){
                value = value.toFixed(2)
	    }else{
                value = 'null'
	    }
	    let cc = ''
	    if('label' in config){
		let str = config['label']
		let items = str.match(/[^\${}]+(?=\})/g)
		let ii
		for(let jj in items){
		    let key_word = items[jj]
                    if(isFloat(datas[i][key_word])){
	                ii = datas[i][key_word].toFixed(2)
		    }else{
	                ii = datas[i][key_word]
		    }
		    str = str.replace('${'+key_word+'}', ii)
		}
	        cc = str 
	    }
	    // Make Tooltip Pane
	    let tooltip_pane = this.basemap.createPane('toolTipPane')
            tooltip_pane.style.zIndex = 3000
	    // Produce a point
	    L.circleMarker(
                [datas[i]['lat'], datas[i]['lon']], {
	            className: 'circle_transition',
	            radius: 3.5,
	            color: "white",
	            weight: 1,
	            fillColor: d_color,
	            fillOpacity: 1.0,
	            name: name,
	            value: value
	        }
	    )
	    .bindTooltip(`${cc}`, {pane: tooltip_pane})
	    .addTo(this.pts_group)
	}//end forloop

        return this 
    }

    //TODO: I think there should be some function which will clear all layers and points and colorbars
    clearPoints () {
        this.pts_group.clearLayers()
        //TODO: clear colorbar	
	//d3.select('#'+this.outDOM).select("#colorbox").remove()
    }
    //TODO: add params config?
    addContourf (jsondata, data_type='geojson') {
        /* 
	 * jsondata: geojson
	 */
	if(this.contourf_layer) {
	    this.contourf_layer.clearLayers()
	    this.contourf_layer.addData(jsondata, {
                style: setStyle4CF,
	    })
	}else{
            this.basemap.createPane('contourfPane')
	    this.basemap.getPane('contourfPane').style.zIndex = 300

	    if(data_type == 'geojson') {
	        this.contourf_layer = L.geoJSON(jsondata, {
                    style: setStyle4CF,
	            pane: 'contourfPane',
                    //onEachFeature: function (feature, layer) {
                    //}
	        })
	    }else if(data_type == 'topojson') {
	        this.contourf_layer = L.topoJson(jsondata, {
                    style: setStyle4CF,
	            pane: 'contourfPane',
                    //onEachFeature: function (feature, layer) {
                    //}
	        })
	    }
	    //
	    this.contourf_layer.addTo(this.basemap)
	    this.layer_control.addOverlay(this.contourf_layer, "contourf")
	}
    } //end of addContourf


    // select_change
    //TODO:change_name (Done?)
    _select_change (change_name) {
	let pts_g = this.pts_group
        for(i in pts_g._layers){
            if(pts_g._layers[i].options.name == change_name){
                let lng = pts_g._layers[i]._latlng['lng']
                let lat = pts_g._layers[i]._latlng['lat']
                this._pt_click(pts_g._layers[i], basemap_key_flag)
                this.basemap.flyTo([lat,lng], 9)
                break
	    }
	}
    }
    // pt_click function
    _pt_click (clickedCircle, kflag) {
        // TODO:unclicked other pts (this should be a method, not in the _pt_click)
	if(this.clicking_pts.length > 0 && !kflag){
	    for(let i in this.clicking_pts){
                this.clicking_pts[i][0].setStyle({fillColor: this.clicking_pts[i][1]})
                this.clicking_pts[i][0].setRadius(6)
	    }
	    this.clicking_pts = []
	}//endif

	let name = clickedCircle.options.name
	// Store the pts and color
	this.clicking_pts.push([clickedCircle, clickedCircle.options.fillColor])
	//L.DomUtil.addClass(clickedCircle._path, 'circle_transition')

	//after clicking, the color and radius of the point change
        clickedCircle.setStyle({fillColor: 'red'})
        clickedCircle.setRadius(8)
	//TODO: do the custom clicking function
	if(this.click_function){
            this.click_function(name, kflag)
	}
	//setTimeout(function(){
        //    L.DomUtil.removeClass(clickedCircle._path, 'circle_transition')
        //}, 1000)

    }//end pt_click

    _add_color_bar (minr, maxr, scaleColor) {
	//create values
	let num = 10
        let values = []
        for(let i=0; i<=num; i++){
          let a = minr + (maxr - minr) / num * i
          values.push(a.toFixed(2))
        }
	console.log(minr, maxr, values)
	let color_width = 50
	let color_height = 15
	let svg
	//d3.select('#'+this.outDOM).select("#colorbox").remove()
	// create svg part
        svg = d3.select('#'+this.outDOM).append("svg")
	        .attr("id", "colorbox")
	        .attr("preserveAspectRatio", "xMinYMin meet")
                .attr("viewBox", "0 0 600 50")
                // Class to make it responsive.
                .classed("svg-content-responsive", true)
	        .style("margin-top", "20px")

	var groups = svg.selectAll("g.colorbox")
	                .data(values)
	                .enter().append("g")
	                .attr("class", "box")
	                .style("transform", (d, i)=> `translate(${i*color_width+10}px, 0px)`)

	    groups.append("text").text((d, i)=> d)
	          .attr("x", -4)
	          .attr("y", color_height+10)
	          .style("font-size", "12px")
	          .style("font-weight", "bold")

	    groups.append("rect")
	          .attr("class", "box")
	          .attr("fill", (d, i)=>scaleColor(d))
	          .attr("width", color_width)
	          .attr("height", color_height)
	          .attr("stroke", "white")

    }

    _multiple_select_init () {
	let this_ = this
        // init leaflet draw
        new L.Control.Draw({
            draw: {
                marker      : false,
                polygon     : false,
                polyline    : false,
                rectangle   : true,
                circle      : false,
                circlemarker: false,
                //circle: {
                //    metric: 'metric'
                //}
            },
            edit: false
        }).addTo(this_.basemap)
        // Rectangle
        L.Rectangle.include({
            contains: function (latLng) {
                return this.getBounds().contains(latLng)
            }
        })

        this.basemap.on(L.Draw.Event.CREATED, (e)=>{
            //TODO: unselect event
            //if(!basemap_key_flag){
            //    if(LineChart != undefined){
            //        d3.selectAll("#heatmap-chart > svg").remove()
            //        LineChart.destroy()
            //        LineChart = undefined
            //    }
            //    for(i=0; i<this.clicking_pts.length; i++){
            //        this.clicking_pts[i][0].setStyle({fillColor: "gray"})
            //        this.clicking_pts[i][0].setRadius(5)
            //    }
            //    this.clicking_pts = []
            //}

            //select event
            let stas = []
            this_.pts_group.eachLayer((pt)=>{
                if(e.layer.contains(pt.getLatLng())){
                    this_._pt_click(pt, true)
		}
	    })
        })//end this.basemap

    }//endof _multiple_select_init

    setLoader () {
        /* add loader gif to the map and user can call function
	 * TODO: now the gif is fixed, we may change this so that the user can use their gif
         */
        document.getElementById(this.outDOM).classList.add("loader")
        document.getElementById(this.inDOM).hidden = true
        let cc =  document.getElementById(this.colorbarDOM)
	if(cc){
            cc.hidden = true
	}
    }

    deleLoader () {
        document.getElementById(this.outDOM).classList.remove("loader")
	document.getElementById(this.inDOM).hidden = false
	let cc = document.getElementById(this.colorbarDOM)
	if(cc){
            cc.hidden = false
        }
    }
}


function getColorbar(data, elename) {
    let min_value = Infinity, max_value = -Infinity
    let mean = 0, std = 0
    let len = data.length
    let ops = []
    for(i in data){
        let ele = data[i]
        let name = ele.name
        let error = ele[elename]
        //calculate min
        if(error < min_value){
            min_value = error
            //min_ID = name
        }
        //calculate max
        if(error > max_value){
            max_value = error
            //max_ID = name
        }
        // calculate mean
        mean += error
        // calculate pow
        std += Math.pow(error, 2)
        ops.push(name)
    }
    mean /= len
    std = Math.sqrt(std/len - Math.pow(mean, 2))
    // change color range
    let minr = mean - 2*std
    let maxr = mean + 2*std
    var scaleColor = d3.scaleLinear()
		       //.domain([min_value, max_value])
		       .domain([minr, maxr])
	               .range(['#4690f2', '#ff6060'])

    return [scaleColor, minr, maxr]
}

function create_japan_tile_map(mapdata, option) {
  if(!option) option = {};
  var japan = topojson.feature(mapdata, mapdata.objects.japan);
  var tileOptions = { maxZoom: 15, tolerance: 5, extent: 4096, buffer: 64, debug: 0, indexMaxZoom: 0, indexMaxPoints: 100000 };

  var tileIndex = geojsonvt(japan, tileOptions);
  var grid = L.gridLayer({ attribution: "Grid Layer" });
  grid.createTile = function(coords, done) {
   var pad = 0;
   var canvas = document.createElement("canvas");
   var size = this.getTileSize();
   canvas.width = size.x;
   canvas.height = size.y;
   var ctx = canvas.getContext("2d");

   ctx.fillStyle = option.fillStyle || '#333';
   ctx.strokeStyle = option.strokeStyle || '#fff';

   var tile = tileIndex.getTile(coords.z, coords.x, coords.y);
   if (!tile) { return canvas; }

   var features = tile.features;
   for (var i = 0; i < features.length; i++) {
     var feature = features[i]

     ctx.beginPath();
     for (var j = 0; j < feature.geometry.length; j++) {
       var geom = feature.geometry[j];
       for (var k = 0; k < geom.length; k++) {
         var p = geom[k];
         var extent = 4096;

         var x = p[0] / extent * size.x;
         var y = p[1] / extent * size.y;
         if (k) ctx.lineTo(x + pad, y + pad);
         else ctx.moveTo(x + pad, y + pad);
       }
     }

     ctx.fill("evenodd");
     ctx.stroke();
   }

   setTimeout(function() {
     done(null, canvas);
   }, 0);

   return canvas;
 }
 return grid;
}

// This one is for contourf
function setStyle4CF(feature) {
    return {
        fillColor: feature.properties.fill,
	weight: 1,
	//opacity: feature.properties["stroke-opacity"],
	opacity: 0.5,
	color: feature.properties.stroke,
	//dashArray: '3',
	fillOpacity: feature.properties["fill-opacity"]
    }
}

function isFloat(n){
    return Number(n) === n && n % 1 !== 0;
}
