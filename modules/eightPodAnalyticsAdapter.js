import {logError, logInfo, logMessage} from '../src/utils.js';
import {ajax} from '../src/ajax.js';
import adapter from '../libraries/analyticsAdapter/AnalyticsAdapter.js';
import { EVENTS } from '../src/constants.js';
import adapterManager from '../src/adapterManager.js';
import {MODULE_TYPE_ANALYTICS} from '../src/activities/modules.js'
import {getStorageManager} from '../src/storageManager.js';

const analyticsType = 'endpoint';
const MODULE_NAME = `eightPod`;
const MODULE = `${MODULE_NAME}AnalyticProvider`;

/**
 * Custom tracking server that gets internal events from EightPod's ad unit
 */
const trackerUrl = 'https://demo.8pod.com/tracker/track';
export const storage = getStorageManager({moduleType: MODULE_TYPE_ANALYTICS, moduleName: MODULE_NAME})

const {
  BID_WON
} = EVENTS;

export let queue = [];
let context = {};

/**
 * Create eightPod Analytic adapter
 */
const eightPodAnalytics = Object.assign(adapter({url: trackerUrl, analyticsType}), {
  /**
   * Execute on bid won - setup basic settings, save context about EightPod's bid. We will send it with our events later
   */
  track({ eventType, args }) {
    switch (eventType) {
      case BID_WON:
        if (args.bidder === 'eightPod') {
          context[args.adUnitCode] = makeContext(args);

          eightPodAnalytics.setupPage(args);
          break;
        }
    }
  },

  /**
   * Execute on bid won upload events from local storage
   */
  setupPage() {
    queue = this.getEventFromLocalStorage();
  },

  /**
   * Subscribe on internal ad unit tracking events
   */
  eventSubscribe() {
    window.addEventListener('message', async (event) => {
      const data = event.data;

      const frameElement = event.source?.frameElement;
      const parentElement = frameElement?.parentElement;
      const adUnitCode = parentElement?.id;

      trackEvent(data, adUnitCode);
    });

    if (!this._interval) {
      this._interval = setInterval(sendEvents, 10_000);
    }
  },
  resetQueue() {
    queue = [];
  },
  getContext() {
    return context;
  },
  resetContext() {
    context = {};
  },
  getEventFromLocalStorage,
});

/**
 * Create context of event, who emits it
 */
function makeContext(args) {
  const params = args?.params?.[0];
  return {
    bidId: args.seatBidId,
    variantId: args.creativeId || '',
    campaignId: args.cid || '',
    publisherId: params.publisherId,
    placementId: params.placementId,
  };
}

/**
 * Create event, add context and push it to queue
 */
export function trackEvent(event, adUnitCode) {
  if (!event.detail) {
    return;
  }

  const fullEvent = {
    context: eightPodAnalytics.getContext()[adUnitCode],
    eventType: event.detail.type,
    eventClass: 'adunit',
    timestamp: new Date().getTime(),
    eventName: event.detail.name,
    payload: event.detail.payload
  };

  logMessage(fullEvent);
  addEvent(fullEvent);
}

/**
 * Push event to queue, save event list in local storage
 */
function addEvent(eventPayload) {
  queue.push(eventPayload);
  storage.setDataInLocalStorage(`EIGHT_POD_EVENTS`, JSON.stringify(queue), null);
}

/**
 * Gets previously saved event that has not been sent
 */
function getEventFromLocalStorage() {
  const storedEvents = storage.localStorageIsEnabled() ? storage.getDataFromLocalStorage('EIGHT_POD_EVENTS') : null;

  if (storedEvents) {
    return JSON.parse(storedEvents);
  } else {
    return [];
  }
}

/**
 * Send event to our custom tracking server and reset queue
 */
function sendEvents() {
  eightPodAnalytics.eventsStorage = queue;

  if (queue.length) {
    try {
      sendEventsApi(queue, {
        success: () => {
          resetLocalStorage();
          eightPodAnalytics.resetQueue();
        },
        error: (e) => {
          logError(MODULE, 'Cant send events', e);
        }
      })
    } catch (e) {
      logError(MODULE, 'Cant send events', e);
    }
  }
}

/**
 * Send event to our custom tracking server
 */
function sendEventsApi(eventList, callbacks) {
  ajax(trackerUrl, callbacks, JSON.stringify(eventList), {keepalive: true});
}

/**
 * Remove saved events in success scenario
 */
const resetLocalStorage = () => {
  storage.setDataInLocalStorage(`EIGHT_POD_EVENTS`, JSON.stringify([]), null);
}

// save the base class function
eightPodAnalytics.originEnableAnalytics = eightPodAnalytics.enableAnalytics;
eightPodAnalytics.eventsStorage = [];

// override enableAnalytics so we can get access to the config passed in from the page
// Subscribe on events from adUnit
eightPodAnalytics.enableAnalytics = function (config) {
  eightPodAnalytics.originEnableAnalytics(config);
  logInfo(MODULE, 'init', config);
  eightPodAnalytics.eventSubscribe();
};

eightPodAnalytics.disableAnalytics = ((orig) => {
  return function () {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    return orig.apply(this, arguments);
  }
})(eightPodAnalytics.disableAnalytics)

/**
 * Register Analytics Adapter
 */
adapterManager.registerAnalyticsAdapter({
  adapter: eightPodAnalytics,
  code: MODULE_NAME
});

export default eightPodAnalytics;
