# next-ssr-hydration

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

An attempt to make lazy hydration with ssr-prerendering work in the modern Next.js 13/14.

Current versions of Next.js rely on build-time compilation/transformation of the source code so it's very important how you write and structure your code.

You have to not forget that `use client` directive and split the components into files in the right way. Below is an example that works.

## Install

```bash
npm install @fractal-web/next-ssr-hydration
```

## Usage

```ts
// ProductsShowcase.lazy.tsx

'use client'; // DONT FORGET

import dynamic from 'next/dynamic';

import {
  passThroughLoading,
  withHydrationOnDemand,
} from '@fractal-web/next-ssr-hydration';

// the use of `dynamic` instead of `lazy` is important
// that way Next.js' compiler loads the styles of the component eagerly
const ProductsShowcase = dynamic(() => import('./ProductsShowcase'), {
  loading: passThroughLoading,
});

export const ProductsShowcaseLazy = withHydrationOnDemand({
  id: 'ProductsShowcaseLazy', // in the current implementation should be unique per rendered component
  on: ['visible'], // will load the js-bundle of the component and hydrate it when it gets visible in the viewport
})(ProductsShowcase);
```
