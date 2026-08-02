import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: 'https://2102a936c8660c9fdf3ef943e1246c00@o4511799368417280.ingest.de.sentry.io/4511799378837584',
  dataCollection: {
    urlQueryParams: true,
    userInfo: true,
    databaseQueryData: true,
    httpBodies: [
      'incomingRequest',
      'incomingResponse',
      'outgoingRequest',
      'outgoingResponse',
    ],
    httpHeaders: { request: true, response: true },
    stackFrameVariables: true,
  },
});
