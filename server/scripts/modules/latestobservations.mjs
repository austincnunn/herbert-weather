// current weather conditions display
import { distance as calcDistance, directionToNSEW } from './utils/calc.mjs';
import { json } from './utils/fetch.mjs';
import STATUS from './status.mjs';
import { locationCleanup } from './utils/string.mjs';
import { celsiusToFahrenheit, kphToMph } from './utils/units.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

class LatestObservations extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Latest Observations', true);

		// constants
		this.MaximumRegionalStations = 7;
	}

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// calculate distance to each station
		const stationsByDistance = Object.keys(StationInfo).map((key) => {
			const station = StationInfo[key];
			const distance = calcDistance(station.lat, station.lon, weatherParameters.latitude, weatherParameters.longitude);
			return { ...station, distance };
		});

		// sort the stations by distance
		const sortedStations = stationsByDistance.sort((a, b) => a.distance - b.distance);
		// try up to 30 regional stations
		const regionalStations = sortedStations.slice(0, 30);

		// get data for regional stations
		const allConditions = await Promise.all(regionalStations.map(async (station) => {
			try {
				const data = await json(`https://api.weather.gov/stations/${station.id}/observations/latest`);
				// test for temperature, weather and wind values present
				if (data.properties.temperature.value === null
					|| data.properties.textDescription === ''
					|| data.properties.windSpeed.value === null) return false;
				// format the return values
				return {
					...data.properties,
					StationId: station.id,
					city: station.city,
				};
			} catch (e) {
				console.log(`Unable to get latest observations for ${station.id}`);
				return false;
			}
		}));
		// remove and stations that did not return data
		const actualConditions = allConditions.filter((condition) => condition);
		// cut down to the maximum of 7
		this.data = actualConditions.slice(0, this.MaximumRegionalStations);

		// test for at least one station
		if (this.data.length < 1) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const conditions = this.data;

		// sort array by station name
		const sortedConditions = conditions.sort((a, b) => ((a.Name < b.Name) ? -1 : 1));

		this.elem.querySelector('.column-headers .temp.english').classList.add('show');
		this.elem.querySelector('.column-headers .temp.metric').classList.remove('show');

		const lines = sortedConditions.map((condition) => {
			const windDirection = directionToNSEW(condition.windDirection.value);

			const	Temperature = Math.round(celsiusToFahrenheit(condition.temperature.value));
			const WindSpeed = Math.round(kphToMph(condition.windSpeed.value));

			const fill = {};
			fill.location = locationCleanup(condition.city).substr(0, 14);
			fill.temp = Temperature;
			fill.weather = shortenCurrentConditions(condition.textDescription).substr(0, 9);
			if (WindSpeed > 0) {
				fill.wind = windDirection + (Array(6 - windDirection.length - WindSpeed.toString().length).join(' ')) + WindSpeed.toString();
			} else if (WindSpeed === 'NA') {
				fill.wind = 'NA';
			} else {
				fill.wind = 'Calm';
			}

			return this.fillTemplate('observation-row', fill);
		});

		const linesContainer = this.elem.querySelector('.observation-lines');
		linesContainer.innerHTML = '';
		linesContainer.append(...lines);

		this.finishDraw();
	}
}
const shortenCurrentConditions = (_condition) => {
	let condition = _condition;
	condition = condition.replace(/Light/, 'L');
	condition = condition.replace(/Heavy/, 'H');
	condition = condition.replace(/Partly/, 'P');
	condition = condition.replace(/Mostly/, 'M');
	condition = condition.replace(/Few/, 'F');
	condition = condition.replace(/Thunderstorm/, 'T\'storm');
	condition = condition.replace(/ in /, '');
	condition = condition.replace(/Vicinity/, '');
	condition = condition.replace(/ and /, ' ');
	condition = condition.replace(/Freezing Rain/, 'Frz Rn');
	condition = condition.replace(/Freezing/, 'Frz');
	condition = condition.replace(/Unknown Precip/, '');
	condition = condition.replace(/L Snow Fog/, 'L Snw/Fog');
	condition = condition.replace(/ with /, '/');
	return condition;
};
// register display
registerDisplay(new LatestObservations(1, 'latest-observations'));
