
const fs = require('fs');
const file = 'd:/projects/photo to world3d/frontend/app/scenes/edit/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/title: scene\.title \+ ' \(Copy\)',/g, 
  	itle: scene.title.replace(/\\\\s*\\\\(.*\\\\)/g, '') + ' (Copy)',);

txt = txt.replace(/title: scene\.title \+ \\\ \(Alt \ Scan\)\\\,/g, 
  	itle: scene.title.replace(/\\\\s*\\\\(.*\\\\)/g, '') + ' (Copy)',);

let liveTagFind = /{liveScene\.modelType && \([\s\S]*?<\//;
let draftTagFind = /{draftScene\.modelType && \([\s\S]*?<\//;

txt = txt.replace(
  /\{liveScene\.modelType && \([\s\S]*?\}\)/g,
  <span className={\	ext-xs font-bold px-2 py-0.5 rounded-full \\} title={\Model: \\}>
                                       {(!liveScene.modelType || liveScene.modelType.toLowerCase() !== 'dino') ? 'Y' : 'D'}
                                     </span>
);

txt = txt.replace(
  /\{draftScene\.modelType && \([\s\S]*?\}\)/g,
  <span className={\	ext-xs font-bold px-2 py-0.5 rounded-full \\} title={\Model: \\}>
                                      {(!draftScene.modelType || draftScene.modelType.toLowerCase() !== 'dino') ? 'Y' : 'D'}
                                    </span>
);

fs.writeFileSync(file, txt);

