FROM public.ecr.aws/lambda/nodejs:20-arm64

COPY ./package.json ${LAMBDA_TASK_ROOT}
COPY ./package-lock.json ${LAMBDA_TASK_ROOT}
COPY ./tsconfig.json ${LAMBDA_TASK_ROOT}
COPY ./packages ${LAMBDA_TASK_ROOT}/packages
RUN npm ci && npm run build

RUN npm install extract-zip -g
ADD https://github.com/pb33f/openapi-changes/releases/download/v0.0.51/openapi-changes_0.0.51_linux_arm64.zip ${LAMBDA_TASK_ROOT}
RUN npx extract-zip openapi-changes_0.0.51_linux_arm64.zip ${LAMBDA_TASK_ROOT}/openapi-changes-dir/
RUN mv ${LAMBDA_TASK_ROOT}/openapi-changes-dir/openapi-changes ${LAMBDA_TASK_ROOT}/openapi-changes
RUN chmod +x ${LAMBDA_TASK_ROOT}/openapi-changes
RUN rm -R ${LAMBDA_TASK_ROOT}/openapi-changes-dir/ && rm ${LAMBDA_TASK_ROOT}/openapi-changes_0.0.51_linux_arm64.zip
ENV PB33F_FILENAME=${LAMBDA_TASK_ROOT}/openapi-changes

CMD [ "packages/ci-tools/build/handler.handler" ]
