import json,sys
plan=json.load(open('/tmp/sk/fullplan.json')); k=int(sys.argv[1]); size=int(sys.argv[2])
acts=[]
for i,n in plan[k:k+size]:
    acts.append({"name":"javascript_tool","input":{"action":"javascript_exec","tabId":208408291,"text":f"await P1('{i}',{n})"}})
    acts.append({"name":"computer","input":{"action":"zoom","tabId":208408291,"region":[0,0,760,760],"save_to_disk":True,"scale":0.8}})
print(json.dumps(acts,separators=(',',':')))
