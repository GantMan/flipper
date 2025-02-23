/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

jest.mock('../fb-stubs/Logger');
try {
  jest.mock('../fb/Logger');
} catch {
  // Allowed to fail when fb modules are not present.
}

import Server from '../server';
import {init as initLogger} from '../fb-stubs/Logger';
import reducers, {Store} from '../reducers/index';
import {createStore} from 'redux';
import path from 'path';
import os from 'os';
import fs from 'fs';
import androidDevice from '../dispatcher/androidDevice';
import iosDevice from '../dispatcher/iOSDevice';
import Client from '../Client';
import {BaseDevice} from 'flipper';

let server: Server;
let androidCleanup: () => Promise<void>;
const store: Store = createStore(reducers);

beforeAll(() => {
  // create config directory, which is usually created by static/index.js
  const flipperDir = path.join(os.homedir(), '.flipper');
  if (!fs.existsSync(flipperDir)) {
    fs.mkdirSync(flipperDir);
  }

  const logger = initLogger(store);

  androidCleanup = androidDevice(store, logger);
  iosDevice(store, logger);

  server = new Server(logger, store);
  return server.init();
});

test('Device can connect successfully', done => {
  let testFinished = false;
  let disconnectedTooEarly = false;
  const registeredClients: Client[] = [];
  server.addListener('new-client', (client: Client) => {
    // Check there is a connected device that has the same device_id as the new client
    const deviceId = client.query.device_id;
    expect(deviceId).toBeTruthy();
    const devices = store.getState().connections.devices;
    expect(devices.map((device: BaseDevice) => device.serial)).toContain(
      deviceId,
    );

    // Make sure it only connects once
    registeredClients.push(client);
    expect(registeredClients).toHaveLength(1);

    // Make sure client stays connected for some time before passing test
    setTimeout(() => {
      testFinished = true;
      expect(disconnectedTooEarly).toBe(false);
      done();
    }, 5000);
  });
  server.addListener('removed-client', (_id: string) => {
    if (!testFinished) {
      disconnectedTooEarly = true;
    }
  });
}, 20000);

afterAll(() =>
  androidCleanup().then(() => {
    server.close();
  }),
);
