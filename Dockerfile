FROM texlive/texlive:latest
RUN apt-get update && apt-get install -y --no-install-recommends nodejs && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.js .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
