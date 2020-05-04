/// <reference types="@types/googlemaps" />

import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import * as signalR from '@aspnet/signalr';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('map', {static: false}) gmapsElement: ElementRef;
  map: google.maps.Map;
  sigRconnection: any;

  receivedMessagesCount = 1;
  destination;

  constructor() { }

  ngOnInit() {
    this.sigRconnection = new signalR.HubConnectionBuilder()
        .withUrl("http://localhost:5000/chatHub")
        .configureLogging(signalR.LogLevel.Debug)
        .build();

    this.sigRconnection.start()
        .then(() => {
            this.sigRconnection
                .invoke("SendMessage")
                .catch(function (err) {
                        console.error(err.toString());
                    });
    })
    .catch((err) => {
        console.error(err.toString());
    });

    this.sigRconnection.on("ReceiveCoords", (message) => {

        // Transform the coords to a Google LatLng array
        let latLngArr = [];
        for (let i=0; i < message.length; i++) {
            latLngArr.push(
                new google.maps.LatLng(message[i][1], message[i][0]) // Latitude and Longitude are swapped in the TT API
            )
        }

        let first_coords = this.getMinCoords(message);
        let last_coords = this.getMaxCoords(message);

        if(this.receivedMessagesCount == 1) {

          let options = {
              center: new google.maps.LatLng(message[0][1], message[0][0]),
              zoom: 12
          };

          this.map = new google.maps.Map(this.gmapsElement.nativeElement, options);

          // Delivery address comming from the Delivery Ticket API
          let deliveryAddress = '46396 Nygård, Sweden';

          // Get the coordinates from the Google API and draw the remaining path
          this.ensureDestinationCoords(deliveryAddress)
              .then((data) => {
                  this.destination = data;
                  // drawRoute(last_coords, data, map);
              });
        }
        this.receivedMessagesCount++;

        // Draw the truck path
        this.drawPolyline(latLngArr, this.map)

        //drawRoute(last_coords, destination, map);

        console.log('latLngArr', latLngArr, this.map)
    });
  }

  ngOnDestroy(): void {
    throw new Error("Method not implemented.");
  }

  drawMarkers(markers, map) {
      for(let i = 0; i < markers.length; i++) {
          new google.maps.Marker({
              position: markers[i],
              map: map
          });
      }
  }

  drawPolyline(path, map) {
      var polyline = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: '#FF0000',
          strokeOpacity: 1.0,
          strokeWeight: 2
      });

      polyline.setMap(map);
  }

  getMinCoords(path) {
      let lat = path.map(function (p) { return p[0] });
      let lng = path.map(function (p) { return p[1] });

      return {
          lat: Math.min.apply(null, lng),
          lng: Math.min.apply(null, lat)
      }
  }

  getMaxCoords(path) {
      let lat = path.map(function (p) { return p[0] });
      let lng = path.map(function (p) { return p[1] });

      return {
          lat: Math.max.apply(null, lng),
          lng: Math.max.apply(null, lat)
      }
  }

  ensureDestinationCoords(destination) {
      if(typeof destination == 'string') {
          return this.geocodeAddress(destination)
      }
      else {
          return new Promise((resolve) => {
              resolve(destination)
          });
      }
  }

  drawRoute(origin, destination, map) {
      let request = {
          origin: new google.maps.LatLng(origin),
          destination: destination,
          travelMode: google.maps.TravelMode.DRIVING
      }

      var directionsService = new google.maps.DirectionsService();

      let rendererOptions = this.getRendererOptions();
      var directionsRenderer = new google.maps.DirectionsRenderer(rendererOptions);
      directionsRenderer.setMap(map);

      directionsService.route(request, (response, status) => {
          if (status == google.maps.DirectionsStatus.OK) {
              directionsRenderer.setDirections(response);

              var estimationInfo = new google.maps.InfoWindow();
              var iwContent = response['routes'][0].legs[0].distance.text + '<br />' + response['routes'][0].legs[0].duration.text;

              estimationInfo.setContent(iwContent);

              let bounds = new google.maps.LatLngBounds();
              [origin, destination].map((x) => bounds.extend(x));

              // google.maps.event.addListener(polylineDotted, 'click', function (event) {
              //     estimationInfo.setPosition(event.latLng);
              //     estimationInfo.open(map, this);
              // });

              estimationInfo.setPosition(bounds.getCenter());
              estimationInfo.open(map);
          }
          else {
              console.log("directionsService RESPONSE STATUS", status)
              console.log("directionsService RESPONSE ERROR", response)
          }
      });
  }

  geocodeAddress(address) {
      return new Promise((resolve) => {
          var geocoder = new google.maps.Geocoder();
          geocoder.geocode({'address': address}, (response, status) => {
              if (status === 'OK') {
                  resolve(response[0].geometry.location);
              } else {
                  console.log("geocoder RESPONSE STATUS", status)
                  console.log("geocoder RESPONSE ERROR", response)
              }
          });
      });
  }

  getRendererOptions() {
      var lineSymbol = {
          path: google.maps.SymbolPath.CIRCLE,
          fillOpacity: 1,
          scale: 3
      };

      var polylineDotted = {
          strokeColor: '#0eb7f6',
          strokeOpacity: 0,
          fillOpacity: 0,
          icons: [{
              icon: lineSymbol,
              offset: '0',
              repeat: '10px'
          }],
      };

      var rendererOptions = {
          suppressMarkers: false,
          polylineOptions: polylineDotted
      };

      return rendererOptions;
  }

}
