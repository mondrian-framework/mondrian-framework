FROM public.ecr.aws/lambda/nodejs:20-arm64

COPY ./package.json ${LAMBDA_TASK_ROOT}
COPY ./package-lock.json ${LAMBDA_TASK_ROOT}
COPY ./tsconfig.json ${LAMBDA_TASK_ROOT}
COPY ./packages ${LAMBDA_TASK_ROOT}/packages
RUN npm ci && npm run build

CMD [ "packages/ci-tools/build/handler.handler" ]
