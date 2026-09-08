// Flood near-white/transparent regions from the canvas boundary. Scanline
// traversal uses one byte per pixel and avoids a full-size integer queue.
export function connectedWhiteBackground(data:Uint8ClampedArray,width:number,height:number,cutoff:number) {
  const mask=new Uint8Array(width*height)
  const eligible=(p:number)=>!data[p*4+3]||Math.min(data[p*4],data[p*4+1],data[p*4+2])>=cutoff
  const seeds:number[]=[]
  const seed=(p:number)=>{if(!mask[p]&&eligible(p)){mask[p]=1;seeds.push(p)}}
  for(let x=0;x<width;x++){seed(x);seed((height-1)*width+x)}
  for(let y=1;y<height-1;y++){seed(y*width);seed(y*width+width-1)}
  while(seeds.length){
    const p=seeds.pop()!,y=Math.floor(p/width),x=p%width
    if(mask[p]===2)continue
    let left=x,right=x
    while(left>0&&mask[y*width+left-1]!==2&&eligible(y*width+left-1))left--
    while(right<width-1&&mask[y*width+right+1]!==2&&eligible(y*width+right+1))right++
    for(let xx=left;xx<=right;xx++){
      const i=y*width+xx;mask[i]=2
      if(y>0)seed(i-width)
      if(y<height-1)seed(i+width)
    }
  }
  return mask
}
