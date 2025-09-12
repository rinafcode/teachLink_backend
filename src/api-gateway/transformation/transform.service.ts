import { Injectable } from '@nestjs/common';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

@Injectable()
export class TransformService {
  private xmlParser = new XMLParser();
  private xmlBuilder = new XMLBuilder();

  /**
   * Transform the incoming request before routing to the microservice.
   * Handles XML->JSON, header manipulation, and protocol translation stubs.
   */
  transformRequest(request: any): any {
    // Add or modify headers
    request.headers['x-gateway'] = 'teachlink-api-gateway';

    // XML to JSON transformation
    if (
      request.headers['content-type'] === 'application/xml' &&
      typeof request.body === 'string'
    ) {
      try {
        request.body = this.xmlParser.parse(request.body);
        request.headers['content-type'] = 'application/json';
      } catch (e) {
        // Optionally log or handle parse error
      }
    }

    // Protocol translation stub (REST to gRPC, etc.)
    // if (request.headers['x-protocol'] === 'grpc') {
    //   // Implement REST to gRPC translation here
    // }

    return request;
  }

  /**
   * Transform the response from the microservice before returning to the client.
   * Handles JSON->XML, header manipulation, and protocol translation stubs.
   */
  transformResponse(response: any): any {
    // Add or modify response headers
    response.headers = response.headers || {};
    response.headers['x-gateway'] = 'teachlink-api-gateway';

    // JSON to XML transformation
    if (
      response.headers['accept'] === 'application/xml' ||
      response.headers['content-type'] === 'application/xml'
    ) {
      try {
        response.body = this.xmlBuilder.build(response.body);
        response.headers['content-type'] = 'application/xml';
      } catch (e) {
        // Optionally log or handle build error
      }
    }

    // Protocol translation stub (gRPC to REST, etc.)
    // if (response.headers['x-protocol'] === 'grpc') {
    //   // Implement gRPC to REST translation here
    // }

    return response;
  }
}
