# Contributing to Mondrian Framework

First off, thank you for considering contributing to Mondrian Framework! It's people like you that make Mondrian Framework such a great tool.

This document provides guidelines for contributing to the project. Please feel free to propose changes to this document in a pull request.

## How Can I Contribute?

There are many ways to contribute, from writing tutorials or blog posts, improving the documentation, submitting bug reports and feature requests, or writing code which can be incorporated into Mondrian Framework itself.

### Reporting Bugs

- Ensure the bug was not already reported by searching on GitHub under [Issues](https://github.com/twinlogix/mondrian-framework/issues).
- If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/twinlogix/mondrian-framework/issues/new). Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

- Open a new issue with your suggestion. Clearly describe the enhancement and the rationale for it. Provide code samples if possible.

### Pull Requests

1.  **Fork the repository** and create your branch from `main`.
2.  **Set up your development environment**. Install dependencies with `npm install`. Also run prisma generation for the example package `npm run generate`.
3.  **Make your changes.** Follow the coding style (see below).
4.  **Add tests** for your changes. Ensure the test suite passes.
5.  **Ensure test coverage** doesn't decrease.
6.  **Update documentation** if your changes affect it.
7.  **Format your code.** We use prettier for code formatting. Run `npm run pretty` before committing.
8.  **Commit your changes** using a clear and descriptive commit message.
9.  **Push to your fork** and submit a pull request to the `main` branch of the main repository.

## Coding Style & Best Practices

- **Testing**: Write tests using `vitest`. Aim for high test coverage. All new features must include tests.
- **Documentation**: Write clear docstrings for modules, classes, functions, and methods. Update project documentation as needed.
- **Commit Messages**: Follow conventional commit message standards if possible.

## Project Structure & Design Choices

For a detailed overview of the project structure and design choices, please refer to the [Mondrian Framework Documentation](https://mondrianframework.com/docs/docs/introduction).

## Getting Started

- Look for issues tagged with `good first issue` for tasks suitable for new contributors.
- Feel free to ask questions in the issue tracker or relevant discussions.

Thank you for your contribution!
