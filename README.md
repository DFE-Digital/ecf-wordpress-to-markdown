# wordpress-to-markdown

This script uses the standard exported XML file from WordPress, and creates a folder/file structure that contains all of the blog posts, converted to markdown format. It will also download all of the images.

Check out the original project for a very in-depth readme. 

## Usage

This program will put the output into `/out-xxx` folder, and also all images will go to `/img`. Image urls are rewritten to `./img`, which is what most markdown static site generators enjoy.

We will use it to translate [the NERO site](https://www.early-career-framework.education.gov.uk/) site into markdown. To get it working download the 5 relevant exports (1 for main site, 4 for each provider), name them `in-common`, `in-xxx` where `xxx` is the provider name (check `convert.js` if you aren't sure), run `yarn install`, `yarn convert` and enjoy.

If you convert the files and open some of them, you will notice are not fully converted - in particular they have a bunch of commented out wordpress tags. Thats where hard work comes in. We will be writing more components in, and handling them in Rails using [govspeak](https://github.com/alphagov/govspeak). We will probably need to add some components to it though. 

You can find translating a wordpress button into govspeak button in `articleCleanup` under 
```
// ============================ Custom conversions ============================
```
line - I know, the structure is a bit of a mess, we might improve it as we go along.

### License

The MIT License (MIT)

Copyright (c) 2013 Jason Young

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

