// var pos = respond.user_coords;
// var mapOptions = {
//   center: pos,
//   zoom: 13
// }
// var map;
// if (map != undefined) map.remove();
// map = L.map('map', mapOptions);
// var basemap = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
//   attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
// })

// basemap.addTo(map)


let mymap = L.map('mapid').setView([-27.469770, 153.025131], 11);
// L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
//     attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
//     maxZoom: 18,
//     id: 'mapbox.streets',
//     accessToken: 'ABCDEFG' //ENTER YOUR ACCESS TOKEN HERE
// }).addTo(mymap);
///GLOBAL VARIABLES
//NORMAL TILE LAYER
// let osm = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//   }).addTo(mymap);
//DARK MODE
var osm = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',{
  attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
}).addTo(mymap);
var baseMaps = {
  "OpenStreetMap": osm
}
let geoData_state, pointLayers;
let stopMap, cMarker;
// let sLayerGroup = new L.LayerGroup();
let layerControl = L.control.layers(baseMaps, null, {collapsed: true});
var focused_trip = null, sliderControlEnable = false;
var path, sliderControl = null;
// // Sliders
// var slider = document.getElementById("dataRange");
// var output = document.getElementById("value");
// output.innerHTML = slider.value;
// slider.oninput = function() {
//   //could be potentially where the cache fetching occurs!
//   output.innerHTML = this.value;
// }
//VEHICLES POSITIONS
let buses = {};
// let routes = {};
// let busesIDs = [];
// let current_states = {};

function onMapClick(e) {
  // console.log("map clicked! focused trips = ", focused_trip);
  // console.log("map clicked! focused trips modified = ", focused_trip);
  Object.keys(buses).filter((key) => key !== focused_trip).map((unkey) => buses[unkey][buses[unkey].length-1].setOpacity(1));
  liveFilter(HFBs);
  if (path) {
    mymap.removeLayer(path);
  }
  if (sliderControlEnable) {
    mymap.removeControl(sliderControl);
    sliderControlEnable = false;
  };
  // let markers = buses[focused_trip];
  // if (markers) {
  //   for (var i = 0; i < markers.length-1; i++) {
  //     mymap.removeLayer(markers[i]);
  //   }
  // }
  focused_trip = null;
}
mymap.on('click', onMapClick);
/////////////////
// PT Icons Settings
var options = (obj) => {
  if (obj.trip_id.includes("QR")) {
    return L.marker([obj.latitude, obj.longitude], {
      title: 'Train TripID ' + obj.trip_id,
      clickable: true,
      draggable: false,
      icon: trainIcon
    }).bindPopup(popUpContent(obj), {offset:[-23, -35]});
  } else if (obj.trip_id.includes("BCC")) {
    return L.marker([obj.latitude, obj.longitude], {
      title: 'Ferry TripID ' + obj.trip_id,
      clickable: true,
      draggable: false,
      icon: ferryIcon
    }).bindPopup(popUpContent(obj), {offset:[-21, -30]}); 
  } else {
    return circleMarkerText([obj.latitude, obj.longitude], obj, 0.25, 0.25, 'circle1').bindPopup(popUpContent(obj), {offset:[-12, 10]});
  }
};
//PT Vehicles Position Popup Template
var popUpContent = (obj) => {
  var d = new Date(obj.timestamp_dt);
  return '<p name="trip-id" id="trip-id" class="clearable">' + obj.trip_id + '</p>\
      <table class="popup-table" id="table-vals">\
      <tr class="popup-table-row">\
      <th class="popup-table-header">Datetime:</th>\
      <td name="time-dt" id="time-dt" class="popup-table-data">' + d.toLocaleString() + '</td>\
      </tr>\
      <tr class="popup-table-row">\
      <th class="popup-table-header">Timestamp:</th>\
      <td name="route-id" id="route-id" class="popup-table-data">' + obj.timestamp + '</td>\
      </tr>\
      <tr class="popup-table-row">\
      <th class="popup-table-header">Route ID:</th>\
      <td name="route-id" id="route-id" class="popup-table-data">' + obj.route_id + '</td>\
      </tr>\
      <tr class="popup-table-row">\
      <th class="popup-table-header">Stop ID:</th>\
      <td name="route-id" id="route-id" class="popup-table-data">' + obj.stop_id + '</td>\
      </tr>\
  </table>'
}
//Circle Marker with Text
function circleMarkerText(latLng, obj, radius, borderWidth, circleClass) {
  let icon = changeIcon(obj, radius, borderWidth, circleClass);
  // let icon = busIcon;
  let route_id = route_splitter(obj);
  var marker = L.marker(latLng, {
    icon: icon,
    title: 'Bus '+route_id,
    clickable: true,
    draggable:false,
    alt:obj,
  });
  if (focused_trip !== null && obj.trip_id !== focused_trip) {
    marker.setOpacity(0.35);
  }
  marker.on('click', markerOnClick);
  return marker;
}

function changeIcon(obj, radius, borderWidth, circleClass) {
  var size = radius * 2;
  var style = 'style="width: ' + size + 'em; height: ' + size + 'em; border-width: ' + borderWidth + 'em;"';
  var iconSize = size + (borderWidth * 2);
  var route = route_splitter(obj);
  // console.log(obj);
  var icon = L.divIcon({
    html: '<span class="' + 'circle ' + circleClass + '" ' + style + '>' + route + '</span>',
    className: '',
    iconSize: [iconSize, iconSize]
  });
  return icon;
}

var markerOnClick = (e) => {
  let obj = e.sourceTarget.options.alt;
  var route = route_splitter(obj);
  focused_trip = obj.trip_id;
  Object.keys(buses).filter((key) => key !== obj.trip_id).map((unkey) => buses[unkey][buses[unkey].length-1].setOpacity(0.35));
  // let markers = buses[focused_trip];
  // console.log("length of markers in onclick! ", markers.length);
  ///////NEEDS TO CHANGE TO MAP TO THE EXISTING SHAPEFILE/////////
  // let temp_list = [];
  // for (var i = 0; i < markers.length-1; i++) {
  //   markers[i].setIcon(changeIcon(obj, 0.25, 0.25, 'circle2'));
  //   markers[i].setOpacity(1);
  //   markers[i].addTo(mymap);
  //   temp_list.push(markers[i]._latlng);
  // }
  // temp_list.push(markers[i]._latlng);
  // path = new L.Polyline(temp_list, {color: 'white', weight: 3, dashArray: '10, 5', lineJoin: 'round', lineCap:'round'}).addTo(mymap);
  ////////////////////////////////////////////////////////////////
  liveFilter(route);
  // markers_sender();
}
//////////////////////////////////////////
///////////STATIC ASSETS (e.g., Stops and Path) Fetcher
function render_trajectory(response) {
  traj_shp = response["traj_shp"];
  stop_shp = response["stop_shp"];
  var states = JSON.parse(traj_shp);
  var stops = JSON.parse(stop_shp);
  // var destIcon = L.icon(destOpt);

  // // Creating Marker Destination Options
  // var destOptions = {
  //     title: 'SelectedDestination ' + pos[0] + '+ ' + pos[1],
  //     clickable: true,
  //     draggable: false,
  //     icon: destIcon
  // }

  // var destMarker = L.marker(pos, destOptions);
  // destMarker.bindPopup('Destination with Coordinate <p id="dest_lat"><b>Lat: ' + pos[0] + '</b></p><p id="dest_lon">Lon: ' + pos[1] + '</p>').openPopup();
  // destMarker.addTo(map);

  // var oriOpt = {
  //     iconUrl: '/static/assets/origin.png',
  //     iconSize: [25, 25]
  // }
  // var oriIcon = L.icon(oriOpt);

  // // Creating Marker Destination Options
  // var pointOptions = {
  //     title: 'Features',
  //     clickable: true,
  //     draggable: false,
  //     icon: oriIcon
  // }

  properties = []
  geoData_state = new L.geoJson(states, {
      style: handleStyle,
      pointToLayer: handlePoint,
      onEachFeature: handleFeature,
  }).addTo(mymap);

  layerControl.addOverlay(geoData_state, "geojson_data");

  stopMap = new L.geoJson(stops, {
    style: handleStyle,
    pointToLayer: handlePoint,
    onEachFeature: handleFeature,
  }).addTo(mymap);
  layerControl.addOverlay(stopMap, "stop_data");
  // console.log(layerControl);
  layerControl.addTo(mymap);

  // geoData_state.on('data:loaded', function() {
  //   geoData_state.addTo(mymap);
  //   mymap.fitBounds(geoData_state.getBounds());
  // })

  if (states.features.length > 0) {
      var props = []
      states.features.forEach(x => props.push(x.properties.time));
      // setLegend(props);
  }

  // function setLegend(properties) {
  //     var legend = L.control({position: 'bottomleft'});
  //     legend.onAdd = function (map) {
  //         var div = L.DomUtil.create('div', 'info legend');
  //         labels = ['<strong>Categories</strong>'],
  //         categories = properties;
  //         for (var i = 0; i < categories.length; i++) {

  //             div.innerHTML += 
  //                 labels.push(
  //                     '<i class="circle" style="background:' + setRegionColor(categories[i]) + '"></i>' +
  //                 (categories[i] ? categories[i] / 60 + ' mins' : '+'));
  //             }
  //             div.innerHTML = labels.join('<br>');
  //         return div;
  //     };
  //     legend.addTo(map);
  // }
}
//////////////////////////
//////PT Vehicles Fetcher
var source = new EventSource('/gtfs_data'); //ENTER YOUR TOPICNAME HERE
source.addEventListener('message', function(e){
  obj = JSON.parse(e.data);
  if (obj.latitude !== null && obj.longitude !== null) {
    if (!(obj.trip_id in buses)) {
      let markers = [];
      // marker1 = circleMarkerText([obj.latitude, obj.longitude], obj, 0.25, 0.25, 'circle1').addTo(mymap).bindPopup(popUpContent(obj));
      marker1 = options(obj).addTo(mymap).bindPopup(popUpContent(obj));
      markers.push(marker1);
      buses[obj.trip_id] = markers;
    } else {
      // let newMarkers = [];
      // marker1 = buses[obj.trip_id].pop();
      // marker1.setLatLng([obj.latitude, obj.longitude]);
      // newMarkers.push(marker1);
      // buses[obj.trip_id] = newMarkers;
      let newMarkers = buses[obj.trip_id];
      let marker_lats = newMarkers.map((marker) => marker.options.alt.latitude);
      let marker_longs = newMarkers.map((marker) => marker.options.alt.longitude);
      if (marker_lats.indexOf(parseFloat(obj.latitude)) == -1 && marker_longs.indexOf(parseFloat(obj.longitude)) == -1) {
        // marker1.setLatLng([obj.latitude, obj.longitude]);
        // let temp = [];
        for (var i = 0; i < newMarkers.length; i ++) {
          mymap.removeLayer(newMarkers[i]);
          // temp.push(newMarkers[i]._latlng);
        }
        marker1 = options(obj).addTo(mymap).bindPopup(popUpContent(obj));
        // marker1 = L.marker([obj.latitude, obj.longitude], options(obj)).addTo(mymap).bindPopup(popUpContent(obj));
        if (newMarkers.length >= 3) {
          var firstmarker = newMarkers.shift();
        } 
        newMarkers.push(marker1);
        // newMarkers.push(marker1);
        buses[obj.trip_id] = newMarkers;
      }
      
    }
  }
}, false);
//////////////////////////
// Miscellaneous 
var route_splitter = (obj) => {
  return obj.route_id.split("-")[0];
}
function markers_sender() {
  if (focused_trip) {
    let markers = buses[focused_trip];
    // let temp_list = [];
    // for (var i = 0; i < markers.length-1; i++) {
    //   let obj = markers[i].options.title
    //   markers[i].setIcon(changeIcon(obj, 0.25, 0.25, 'circle2'));
    //   markers[i].setOpacity(1);
    //   markers[i].addTo(mymap);
    //   temp_list.push(markers[i]._latlng);
    // }
    // temp_list.push(markers[i]._latlng);
    // path = new L.Polyline(temp_list, {color: 'white', weight: 3, dashArray: '10, 5', lineJoin: 'round', lineCap:'round'}).addTo(mymap);
    let temp_list = [];
    for (var i = 0; i < markers.length; i++) {
      let obj = markers[i].options.alt
      // markers[i].setIcon(changeIcon(obj, 0.25, 0.25, 'circle2'));
      // markers[i].setOpacity(1);
      // markers[i].addTo(mymap);
      temp_list.push(obj);
    }
    request_data = JSON.stringify({'markers': temp_list});
    $.ajax({
      url: '/',
      type: 'POST',
      contentType: "application/json; charset=utf-8",
      data: request_data,
      dataSrc: "markerSelection",
      error: function(e) {
        console.log(e);
      },
      success: function(response) {
        if (sliderControlEnable) {
          // sliderControl.removeLayer(pointLayers);
          mymap.removeControl(sliderControl);
          sliderControlEnable = False;
        };
        // console.log(response); // EXPECTED TO BE A GEOJSON POINTS
        jsonRes = JSON.parse(response.features);
        // jsonRes = JSON.parse(response.features);
        // mymap.removeLayer(geoData_state);
        // if (response == "") {
        //   layerControl.clearLayers();
        // } else {
        //   makeStateMap(response);
        // }
        // render_trajectory(response);
        // console.log("json = ", jsonRes);
        pointLayers = L.geoJson(jsonRes, {
          onEachFeature: function (feature, layer) {
            let popup = pointPopUp(feature.properties);
            layer.bindPopup(popup).openPopup();
          },
          pointToLayer: function(feature, latlng) {
            let icon = changeIcon(feature.properties, 0.25, 0.25, 'circle1');
            return L.marker(latlng, {
              icon: icon,
              title: obj,
            });
          }
        });
        sliderControl = L.control.sliderControl({
            position: "topright",
            layer: pointLayers,
        });
        mymap.addControl(sliderControl);
        sliderControl.startSlider();
        sliderControlEnable = true;
      },
    });
    // temp_list.push(markers[i]._latlng);
    // path = new L.Polyline(temp_list, {color: 'white', weight: 3, dashArray: '10, 5', lineJoin: 'round', lineCap:'round'}).addTo(mymap);
  }
}
function liveFilter(selectedBuses) {
  let routes = [];
  if (!Array.isArray(selectedBuses)) {
    routes = [selectedBuses];
  } else {
    routes = selectedBuses;
  }
  request_data = JSON.stringify({'routes': routes})
  $.ajax({
    url: '/',
    type: 'POST',
    contentType: "application/json; charset=utf-8",
    data: request_data,
    dataSrc: "checkedboxRoutes",
    error: function(e) {
      console.log(e);
    },
    success: function(response) {
      mymap.removeLayer(geoData_state);
      if (response == "") {
        layerControl.clearLayers();
      } else {
        makeStateMap(response);
      }
      // render_trajectory(response);
    },
  });
}
//////////////////////////
/////CHECKBOXES
//Static Checkboxes Front-End Generator
function render_checkboxes_routes() {
  // let HFBs = Object.keys(routes);
  let myRoutes = document.getElementById("checkboxRoutes");

  for (let i = 0; i < HFBs.length; i++) {
    let checkBox = document.createElement("input");
    let label = document.createElement("label");
    let br = document.createElement("br");
    checkBox.type = "checkbox";
    checkBox.value = HFBs[i];
    checkBox.name = "routes";
    myRoutes.appendChild(checkBox);
    myRoutes.appendChild(label);
    label.appendChild(document.createTextNode(HFBs[i]));
    myRoutes.appendChild(br);
  }
}
//Changes occurring on the Checkboxes Function
const checkedBoxRoutes = document.getElementById("checkboxRoutes");
let selectedRoutes = [];
// Update Layers based on these changes
function makeStateMap(response) {
  traj_shp = response["traj_shp"];
  stop_shp = response["stop_shp"];
  let state = JSON.parse(traj_shp);
  let stop = JSON.parse(stop_shp);
  stopMap.clearLayers();
  layerControl.removeLayer(geoData_state);
  layerControl.removeLayer(stopMap);
  geoData_state = new L.geoJson(state, {
    style: newStyle,
    pointToLayer: handlePoint,
    onEachFeature: handleFeature,
  }).addTo(mymap);

  stopMap = new L.geoJson(stop, {
    style: handleStyle,
    pointToLayer: handlePoint,
    onEachFeature: handleFeature
  }).addTo(mymap);
  layerControl.addOverlay(geoData_state, "geojson_data");
  layerControl.addOverlay(stopMap, "stop_data");
  // mymap.addLayer(layerControl);
}
function toggle(source) {
  let checkboxes = document.getElementsByName("routes");
  for (let i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = source.checked;
  }
}
// //On change event
// checkedBoxRoutes.addEventListener('change', event => {
//   if (event.target.type == 'checkbox') {
//     const checked = document.querySelectorAll('input[type="checkbox"]:checked');
//     // console.log(checked);
//     checkedVals = Array.from(checked).map(x => x.value);
//     selectedRoutes = checkedVals.filter(x => Number(x))
//   }
//   if (selectedRoutes.length > 0) {
//     liveFilter(selectedRoutes);
//   } else {
//     stopMap.clearLayers();
//     layerControl.removeLayer(geoData_state);
//     layerControl.removeLayer(stopMap);
//   }
// })
//////////