
const fs = require('fs');
const file = 'd:/projects/photo to world3d/frontend/app/upload/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/body: JSON\.stringify\(\{\s+title:.*?\s+imageUrl:.*?\s+hotspots:.*?\s+status:.*?\s+\}\)/g,
\ody: JSON.stringify({
            title: sceneTitle || 'Untitled',
            imageUrl: serverImageUrl,
            modelType: modelType.toLowerCase(),
            hotspots: previewHotspots,
            status: isDraft ? 'DRAFT' : 'LIVE'
          })\);

fs.writeFileSync(file, txt);

