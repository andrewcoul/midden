#!/usr/bin/env bash
RUN=$RANDOM
set -u
# End-to-end API check against a running dev server (bun run dev).
# Usage: scripts/smoke-test.sh   Password: MIDDEN_TEST_PASSWORD (default midden-dev)
PW=${MIDDEN_TEST_PASSWORD:-midden-dev}
cd "$(mktemp -d)"
B=${MIDDEN_URL:-http://localhost:3000}; J=cookies.txt; H=(-H 'X-Requested-With: midden'); rm -f $J
ok(){ printf '  ok   %s\n' "$1"; }; bad(){ printf '  FAIL %s -> %s\n' "$1" "$2"; FAILS=$((FAILS+1)); }; FAILS=0
jq_(){ python3 -c "import json,sys; d=json.load(sys.stdin); print(eval('d'+sys.argv[1]))" "$1"; }
curl -s -c $J "${H[@]}" -H 'Content-Type: application/json' -d '{"password":"wrong"}' $B/api/login | grep -q Wrong && ok "wrong password rejected" || bad "wrong pw" ""
curl -s -c $J "${H[@]}" -H 'Content-Type: application/json' -d "{\"password\":\"$PW\"}" $B/api/login | grep -q ok && ok login || bad login ""
C=(-b $J -c $J "${H[@]}")
code=$(curl -s -o /dev/null -w '%{http_code}' -b $J -X POST -H 'Content-Type: application/json' -d '{"parentId":"root","name":"x"}' $B/api/folders); [ "$code" = 403 ] && ok "CSRF header required" || bad csrf $code
F=$(curl -s "${C[@]}" -H 'Content-Type: application/json' -d '{"parentId":"root","name":"Beach house '$RUN'"}' $B/api/folders | jq_ "['id']"); [ -n "$F" ] && ok "create folder $F" || bad folder ""
F2=$(curl -s "${C[@]}" -H 'Content-Type: application/json' -d '{"parentId":"root","name":"Beach house '$RUN'"}' $B/api/folders | jq_ "['name']"); [ "$F2" = "Beach house $RUN (2)" ] && ok "duplicate name -> $F2" || bad dupname "$F2"
printf 'hello midden\n' > small.txt
S=$(curl -s "${C[@]}" -X PUT --data-binary @small.txt "$B/api/upload?parentId=$F&name=notes.txt&mime=text/plain" | jq_ "['id']"); [ -n "$S" ] && ok "small upload" || bad small ""
body=$(curl -s -b $J "$B/api/files/$S/content"); [ "$body" = "hello midden" ] && ok "download content" || bad dl "$body"
r=$(curl -s -b $J -H 'Range: bytes=6-11' "$B/api/files/$S/content"); [ "$r" = "midden" ] && ok "range request" || bad range "$r"
head -c $((25*1024*1024+123)) /dev/urandom > big.bin; SUM=$(sha256sum big.bin | cut -c1-16)
U=$(curl -s "${C[@]}" -H 'Content-Type: application/json' -d "{\"parentId\":\"$F\",\"name\":\"big.bin\",\"size\":$(stat -c%s big.bin)}" $B/api/uploads)
UID_=$(echo "$U" | jq_ "['id']"); PS=$(echo "$U" | jq_ "['partSize']"); N=$(echo "$U" | jq_ "['parts']")
PARTS=""; for n in $(seq 1 $N); do dd if=big.bin of=part bs=$PS skip=$((n-1)) count=1 status=none; P=$(curl -s "${C[@]}" -X PUT --data-binary @part "$B/api/uploads/$UID_/parts/$n"); PARTS="$PARTS$P,"; done
BIG=$(curl -s "${C[@]}" -H 'Content-Type: application/json' -d "{\"parts\":[${PARTS%,}]}" "$B/api/uploads/$UID_/complete" | jq_ "['id']")
GOT=$(curl -s -b $J "$B/api/files/$BIG/content" | sha256sum | cut -c1-16); [ "$GOT" = "$SUM" ] && ok "chunked upload ($N parts) round-trips" || bad chunked "$GOT vs $SUM"
L=$(curl -s -b $J "$B/api/folders/root"); echo "$L" | grep -q '"childCount":2' && ok "folder childCount" || bad childcount "$(echo $L | head -c 300)"
SH=$(curl -s "${C[@]}" -H 'Content-Type: application/json' -d "{\"nodeId\":\"$F\",\"password\":\"pw\",\"expiresInDays\":7}" $B/api/shares | jq_ "['id']"); [ -n "$SH" ] && ok "create share" || bad share ""
curl -s "$B/api/s/$SH" | grep -q '"locked":true' && ok "share locked without password" || bad locked ""
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/s/$SH/files/$S/content"); [ "$code" = 401 ] && ok "locked file blocked" || bad lockedfile $code
curl -s -c pub.txt -H 'X-Requested-With: midden' -H 'Content-Type: application/json' -d '{"password":"pw"}' "$B/api/s/$SH/unlock" | grep -q ok && ok "unlock share" || bad unlock ""
body=$(curl -s -b pub.txt "$B/api/s/$SH/files/$S/content"); [ "$body" = "hello midden" ] && ok "public download in shared folder" || bad pubdl "$body"
code=$(curl -s -o /dev/null -w '%{http_code}' -b pub.txt "$B/api/s/$SH/files/root/content"); [ "$code" = 404 ] || [ "$code" = 400 ] && ok "cannot escape shared folder ($code)" || bad escape $code
curl -s "${C[@]}" -X POST "$B/api/nodes/$F/trash" | grep -q ok && ok trash || bad trash ""
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/s/$SH"); [ "$code" = 404 ] && ok "share hidden when trashed" || bad sharetrash $code
curl -s -b $J "$B/api/trash" | grep -q "$F" && ok "listed in trash" || bad trashlist ""
curl -s "${C[@]}" -X POST "$B/api/nodes/$F/restore" | grep -q "$F" && ok restore || bad restore ""
curl -s -b $J "$B/api/recent" | grep -q big.bin && ok "recent files" || bad recent ""
curl -s -b $J "$B/api/search?q=notes" | grep -q notes.txt && ok search || bad search ""
curl -s "${C[@]}" -X DELETE "$B/api/nodes/$F" | grep -q ok && ok "delete forever" || bad del ""
code=$(curl -s -o /dev/null -w '%{http_code}' -b $J "$B/api/files/$BIG/content"); [ "$code" = 404 ] && ok "deleted file gone" || bad gone $code
echo "failures: $FAILS"
