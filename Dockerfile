FROM scratch
ADD build/trifecta trifecta
ADD html html
VOLUME /local-db

EXPOSE 1234
ENTRYPOINT ["/trifecta", "-p", "1234","/local-db/trifecta.sqlite"]
