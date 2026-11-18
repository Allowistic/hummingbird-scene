import re, numpy as np
def load(path='RISK_tag_smooth_CNC_vectors.svg', n=16):
    s=open(path).read()
    layers={}
    for gm in re.finditer(r'<g id="([^"]+)">(.*?)</g>', s, re.S):
        gid=gm.group(1); polys=[]
        for pm in re.finditer(r'd="([^"]*)"', gm.group(2)):
            toks=re.findall(r'[MCZLmczl]|-?[\d.]+(?:e-?\d+)?', pm.group(1))
            i=0; cur=None; poly=[]
            while i<len(toks):
                t=toks[i]
                if t=='M':
                    cur=(float(toks[i+1]),float(toks[i+2])); poly=[cur]; i+=3
                elif t=='C':
                    i+=1
                    while i<len(toks) and toks[i] not in 'MCZLmczl':
                        p=[float(x) for x in toks[i:i+6]]; i+=6
                        P0=np.array(cur);P1=np.array(p[0:2]);P2=np.array(p[2:4]);P3=np.array(p[4:6])
                        for k in range(1,n+1):
                            u=k/n; q=(1-u)**3*P0+3*(1-u)**2*u*P1+3*(1-u)*u*u*P2+u**3*P3
                            poly.append(tuple(q))
                        cur=tuple(P3)
                elif t=='L':
                    cur=(float(toks[i+1]),float(toks[i+2])); poly.append(cur); i+=3
                elif t=='Z':
                    polys.append(np.array(poly)); i+=1
                else: raise Exception(t)
        layers[gid]=polys
    return layers
