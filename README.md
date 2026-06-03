# PolygonGraph

A simple Angular application that demonstrates how to create a polygon graph using SVG. The graph is interactive and allows users to visualize data in a polygonal format.


## Prerequisites
This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.8.
```bash
nvm install 20
nvm use 20
```



## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Usage
Drag existing points to change the shape of the polygon. Double-Click (near Polygon Area) on the graph to add new points. Click on existing points to remove them.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Example Polygon Coordinates
```
[
[47.130305, 7.253391],
[47.130761, 7.254697],
[47.130991, 7.255273],
[47.131213, 7.255802],
[47.131597, 7.256545],
[47.13198, 7.25706],
[47.132374, 7.257465],
[47.132587, 7.25805],
[47.131401, 7.25831],
[47.130737, 7.258471],
[47.130564, 7.258457],
[47.13017, 7.255496],
[47.130166, 7.254718],
[47.130208, 7.252929]
]
```
